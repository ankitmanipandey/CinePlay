import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

const CinePlayLogo = ({ size = 38 }) => {
    const gradId = `cineplayGrad-${useId()}`;

    return (
        <View style={{ width: size, height: size }}>
            <Svg viewBox="0 0 500 500" width={size} height={size}>
                <Defs>
                    <SvgLinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#00E5FF" />
                        <Stop offset="50%" stopColor="#9B51E0" />
                        <Stop offset="100%" stopColor="#FF007A" />
                    </SvgLinearGradient>
                </Defs>
                <Circle cx="250" cy="250" r="250" fill={`url(#${gradId})`} />
                <Path
                    d="M 190 145 L 365 250 L 190 355 Z"
                    fill="#FFFFFF"
                    stroke="#FFFFFF"
                    strokeWidth="25"
                    strokeLinejoin="round"
                />
            </Svg>
        </View>
    );
};

export default CinePlayLogo;