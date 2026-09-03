import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useVehicle, type VehicleState } from '../useVehicle';
import type { Vehicle } from '../../types';

// This version of the package ships no jest mock, so here is a small
// in-memory one. It is deliberately async, since the whole point of the
// `ready` flag is that reads do not resolve synchronously.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

const truck: Vehicle = {
  label: 'My truck',
  fuelType: 'gas',
  capacity: 29,
  efficiency: 20,
  level: 0.25,
};

/** Mounts the hook fresh, as an app launch would. */
async function launch() {
  const box: { current: VehicleState | undefined } = { current: undefined };
  function Probe() {
    box.current = useVehicle();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe />);
  });
  return {
    get state() {
      return box.current!;
    },
    unmount: () => act(() => renderer.unmount()),
  };
}

describe('useVehicle', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('still has the vehicle after a relaunch', async () => {
    const first = await launch();
    await act(async () => {
      await first.state.save(truck);
    });
    first.unmount();

    const second = await launch();
    expect(second.state.ready).toBe(true);
    expect(second.state.vehicle).toEqual(truck);
  });

  it('reports not-ready until storage has answered', async () => {
    // The window this flag exists for: before it resolves, `vehicle` is
    // undefined for a reason that has nothing to do with the driver not
    // having one, and the UI must not claim otherwise.
    let resolveRead: (value: string | null) => void = () => {};
    const pending = new Promise<string | null>((resolve) => {
      resolveRead = resolve;
    });
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(pending as never);

    const box: { current: VehicleState | undefined } = { current: undefined };
    function Probe() {
      box.current = useVehicle();
      return null;
    }
    await act(async () => {
      create(<Probe />);
    });

    expect(box.current!.ready).toBe(false);
    expect(box.current!.vehicle).toBeUndefined();

    await act(async () => {
      resolveRead(JSON.stringify(truck));
      await pending;
    });

    expect(box.current!.ready).toBe(true);
    expect(box.current!.vehicle).toEqual(truck);
    spy.mockRestore();
  });

  it('forgets the vehicle when the driver removes it', async () => {
    const first = await launch();
    await act(async () => {
      await first.state.save(truck);
    });
    await act(async () => {
      await first.state.clear();
    });
    first.unmount();

    const second = await launch();
    expect(second.state.vehicle).toBeUndefined();
  });

  it('survives a corrupt stored profile rather than wedging', async () => {
    await AsyncStorage.setItem('guzzler.vehicle.v1', '{not json');
    const launched = await launch();
    expect(launched.state.ready).toBe(true);
    expect(launched.state.vehicle).toBeUndefined();
  });
});
