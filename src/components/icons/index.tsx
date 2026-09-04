import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * Guzzler's icons, drawn rather than borrowed.
 *
 * These replaced emoji. Emoji are drawn by the operating system, so they carry
 * someone else's palette and line weight, ignore `color` entirely, and shift
 * shape between iOS versions — 🚻 and 🍔 next to a hot rod decal read as
 * placeholder art, because that is what they were.
 *
 * All of them live on a 24x24 grid as filled silhouettes with even-odd holes,
 * so a counter stays a hole rather than a patch of background colour that
 * breaks the moment the icon sits on a different surface. Solid rather than
 * stroked because the brand is chunky and because thin strokes disappear at
 * the 14px these run at inside chips.
 *
 * Generated shapes, hand-checked at 24px: anything that stopped reading small
 * got redrawn. The wheel gained a hub and spokes because a plain ring was a
 * doughnut, and "centre on me" became the heading arrow every map app uses
 * because a ring inside crosshair ticks was a sun.
 */
export interface IconProps {
  size?: number;
  color?: string;
}

export function PumpIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 2h6a2 2 0 0 1 2 2v17H3V4a2 2 0 0 1 2-2zM5.5 5h5v4.5h-5z" fill={color} fillRule="evenodd" />
      <Path d="M13 7h2.5A2.5 2.5 0 0 1 18 9.5V15a1.25 1.25 0 0 0 2.5 0v-4.2l-1.6-1.6 1.4-1.4L22 9.4V15a2.75 2.75 0 0 1-5.5 0V9.5a1 1 0 0 0-1-1H13z" fill={color} fillRule="evenodd" />
      <Path d="M1.5 21h14v2h-14z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function BoltIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14 1 4.5 13.5H10l-1 9.5 10-13H13z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function RestroomIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 1.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z" fill={color} fillRule="evenodd" />
      <Path d="M3.6 6.4h5.8a1.5 1.5 0 0 1 1.5 1.5v5.3H9.3v9.6H7.6v-6.2H5.4v6.2H3.7v-9.6H2.1V7.9a1.5 1.5 0 0 1 1.5-1.5z" fill={color} fillRule="evenodd" />
      <Path d="M17.5 1.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z" fill={color} fillRule="evenodd" />
      <Path d="M17.5 6.4c1.8 0 2.9.7 3.3 2.2l1.4 5.3h-2.1l-.9-3.4v12.3h-1.9v-6.4h-1.6v6.4h-1.9V10.5l-.9 3.4h-2.1l1.4-5.3c.4-1.5 1.5-2.2 3.3-2.2z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function FoodIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.2c4.6 0 8.3 2.4 8.6 5.4H3.4C3.7 4.6 7.4 2.2 12 2.2z" fill={color} fillRule="evenodd" />
      <Path d="M3.2 9.9h17.6a1.15 1.15 0 0 1 0 2.3H3.2a1.15 1.15 0 0 1 0-2.3z" fill={color} fillRule="evenodd" />
      <Path d="M3.4 14.2h17.2c-.4 3.5-4 6.2-8.6 6.2s-8.2-2.7-8.6-6.2z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function CoffeeIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 5h13v7.5a5.5 5.5 0 0 1-11 0z" fill={color} fillRule="evenodd" />
      <Path d="M17.5 6.5h1.8a3.2 3.2 0 0 1 0 6.4h-1.1v-2.1h1.1a1.1 1.1 0 0 0 0-2.2h-1.8z" fill={color} fillRule="evenodd" />
      <Path d="M2.5 20h16v2.2h-16z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function AirPumpIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zm0 4.6a5.9 5.9 0 1 0 0 11.8 5.9 5.9 0 0 0 0-11.8z" fill={color} fillRule="evenodd" />
      <Path d="M12 9.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function EvChargingIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7.8 1.5h2.2v5.2H7.8zm6.2 0h2.2v5.2H14z" fill={color} fillRule="evenodd" />
      <Path d="M5 8h14v2.6a7 7 0 0 1-5.7 6.9V21h-2.6v-3.5A7 7 0 0 1 5 10.6z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function CarWashIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 3.5c1.8 2.4 3 4 3 5.4a3 3 0 0 1-6 0c0-1.4 1.2-3 3-5.4z" fill={color} fillRule="evenodd" />
      <Path d="M17.5 3.5c1.8 2.4 3 4 3 5.4a3 3 0 0 1-6 0c0-1.4 1.2-3 3-5.4z" fill={color} fillRule="evenodd" />
      <Path d="M12 12c2 2.7 3.4 4.6 3.4 6.2a3.4 3.4 0 0 1-6.8 0c0-1.6 1.4-3.5 3.4-6.2z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function TruckIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M1.5 4.5h11.8v11H1.5z" fill={color} fillRule="evenodd" />
      <Path d="M14.3 7.6h3.9l3.3 3.6v4.3h-7.2z" fill={color} fillRule="evenodd" />
      <Path d="M6 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" fill={color} fillRule="evenodd" />
      <Path d="M17.5 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function ClockIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zm0 2.4a8.1 8.1 0 1 0 0 16.2 8.1 8.1 0 0 0 0-16.2z" fill={color} fillRule="evenodd" />
      <Path d="M10.9 6h2.2v6.5l4.3 2.5-1.1 1.9-5.4-3.1z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function StarIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1.6l3.1 6.4 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.6 3.2 12 10.6l7.4-7.4 1.4 1.4L13.4 12l7.4 7.4-1.4 1.4L12 13.4l-7.4 7.4-1.4-1.4L10.6 12 3.2 4.6z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 16.4 3.6 8l1.6-1.6L12 13.2l6.8-6.8L20.4 8z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function UndoIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8.6 4.4 10.2 6 7.4 8.8H15a6.6 6.6 0 0 1 0 13.2h-4v-2.2h4a4.4 4.4 0 0 0 0-8.8H7.4l2.8 2.8-1.6 1.6L3 9.9z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function LocateIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21.6 2.4 2.9 10.9a.85.85 0 0 0 .1 1.6l7.2 2.2 2.2 7.2a.85.85 0 0 0 1.6.1z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

