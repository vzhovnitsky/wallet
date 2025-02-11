import React from "react";
import { View, Text, ImageSourcePropType, Image, Pressable, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../../engine/hooks";

export const ProductBanner = React.memo((props: {
    onPress?: () => void,
    title: string,
    subtitle?: string,
    illustration?: ImageSourcePropType,
    reverse?: boolean,
    style?: StyleProp<ViewStyle>,
    illustrationStyle?: StyleProp<ViewStyle>,
}) => {
    const theme = useTheme();

    return (
        <Pressable
            onPress={props.onPress}
            style={({ pressed }) => {
                return [
                    {
                        opacity: pressed ? 0.5 : 1,
                        height: 106,
                        backgroundColor: theme.surfaceOnElevation,
                        borderRadius: 20,
                    },
                    props.style
                ]
            }}
        >
            <View style={{ flexDirection: 'row', flexGrow: 1, alignItems: 'center', paddingLeft: props.reverse ? 20 : 0, paddingRight: props.reverse ? 0 : 20 }}>
                {(!!props.illustration && props.reverse) && (
                    <View style={[{
                        height: 74, width: 96,
                        justifyContent: 'center', alignItems: 'center',
                        overflow: 'hidden',
                        backgroundColor: theme.surfaceOnElevation,
                        borderRadius: 10
                    }, props.illustrationStyle]}>
                        <Image resizeMode={'contain'} source={props.illustration} style={{ height: 74, width: 96 }} />
                    </View>
                )}
                <View style={{
                    justifyContent: 'space-between', padding: 20,
                    flexGrow: 1, flexShrink: 1
                }}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 17, lineHeight: 24 }}
                        ellipsizeMode={'tail'}
                        numberOfLines={1}
                    >
                        {props.title}
                    </Text>
                    {!!props.subtitle && (
                        <Text
                            style={{
                                color: theme.textSecondary,
                                fontSize: 15,
                                lineHeight: 20,
                                flex: 1, flexShrink: 1
                            }}
                            ellipsizeMode={'tail'}
                            numberOfLines={2}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.95}
                        >
                            {props.subtitle}
                        </Text>
                    )}
                </View>
                {(!!props.illustration && !props.reverse) && (
                    <View style={{ height: 74, width: 96, justifyContent: 'center', alignItems: 'center' }}>
                        <Image resizeMode={'contain'} source={props.illustration} style={{ height: 74, width: 96 }} />
                    </View>
                )}
            </View>
        </Pressable>
    );
});