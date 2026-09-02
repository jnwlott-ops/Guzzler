/**
 * The map, on platforms that have one.
 *
 * react-native-maps is native-only — importing it on web throws
 * `codegenNativeComponent is not a function` and takes the whole page down.
 * Metro resolves `PlatformMap.web.tsx` instead when bundling for web, so this
 * file stays a plain re-export and the rest of the app imports from here
 * without caring which platform it's on.
 */
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

export { MapView, Marker, Circle, Polyline, PROVIDER_GOOGLE };
