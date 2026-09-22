import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const GradientText = ({ text = 'CinePlay', fontSize = 26, fontWeight = '900', width = 160, height = 36 }) => {
    return (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
                <LinearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#00E5FF" />
                    <Stop offset="50%" stopColor="#9B51E0" />
                    <Stop offset="100%" stopColor="#FF007A" />
                </LinearGradient>
            </Defs>
            <SvgText
                x="50%"
                y={height / 2 + fontSize * 0.35}
                fontSize={fontSize}
                fontWeight={fontWeight}
                fontFamily="System" 
                fill="url(#textGrad)"
                textAnchor="middle"
            >
                {text}
            </SvgText>
        </Svg>
    );
};

export default GradientText;