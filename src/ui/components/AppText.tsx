import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../theme';

type Weight = keyof typeof fonts;

interface AppTextProps extends TextProps {
  weight?: Weight;
  size?: number;
  color?: string;
}

/** Text wrapper that applies the right Nunito font file per weight (RN can't synthesize it). */
export function AppText({ weight = 'regular', size, color, style, ...rest }: AppTextProps) {
  const base: TextStyle = {
    fontFamily: fonts[weight],
    color: color ?? colors.text,
    ...(size != null ? { fontSize: size } : null),
  };
  return <Text style={[base, style]} {...rest} />;
}
