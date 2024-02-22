import React, { memo, useCallback, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useTypedNavigation } from "../../utils/useTypedNavigation";
import { Avatar } from "../Avatar";
import { useAnimatedPressedInOut } from "../../utils/useAnimatedPressedInOut";
import Animated from "react-native-reanimated";
import { useContact, useDenyAddress, useNetwork, useTheme } from "../../engine/hooks";
import { Address } from "@ton/core";
import { AddressComponent } from "../address/AddressComponent";

export const ContactItemView = memo(({ addressFriendly, action }: { addressFriendly: string, action?: (address: Address) => void }) => {
    const { isTestnet } = useNetwork();
    const theme = useTheme();
    const addr = useMemo(() => Address.parseFriendly(addressFriendly), [addressFriendly]);
    const contact = useContact(addressFriendly);
    const isSpam = useDenyAddress(addr.address.toString({ testOnly: isTestnet }));

    const navigation = useTypedNavigation();

    const { animatedStyle, onPressIn, onPressOut } = useAnimatedPressedInOut();

    const lastName = useMemo(() => {
        if (contact?.fields) {
            return contact.fields.find((f) => f.key === 'lastName')?.value;
        }
    }, [contact]);

    const onPress = useCallback(() => {
        if (action) {
            action(addr.address);
            return;
        }
        navigation.navigate('Contact', { address: addressFriendly });
    }, [addressFriendly, action, addr]);

    return (
        <Pressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
        >
            <Animated.View style={[{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, animatedStyle]}>
                <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 0, marginRight: 12 }}>
                    <Avatar
                        address={addr.address.toString({ testOnly: isTestnet })}
                        id={addr.address.toString({ testOnly: isTestnet })}
                        size={46}
                        borderWith={0}
                        theme={theme}
                        isTestnet={isTestnet}
                        hashColor
                    />
                </View>
                <View style={{ flexGrow: 1, justifyContent: 'center' }}>
                    {contact?.name ? (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text
                                    style={{ flex: 1, color: theme.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600' }}
                                    ellipsizeMode={'tail'}
                                    numberOfLines={1}
                                >
                                    {contact?.name + (lastName ? ` ${lastName}` : '')}
                                </Text>
                                {isSpam && (
                                    <View style={{
                                        backgroundColor: theme.backgroundPrimaryInverted,
                                        borderRadius: 100,
                                        height: 15,
                                        marginLeft: 10,
                                        paddingHorizontal: 5,
                                        justifyContent: 'center',
                                    }}>
                                        <Text style={{
                                            fontSize: 10,
                                            fontWeight: '500',
                                            color: theme.textPrimaryInverted
                                        }}>
                                            {'SPAM'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text
                                style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 20, fontWeight: '400' }}
                                ellipsizeMode={'middle'}
                                numberOfLines={1}
                            >
                                <AddressComponent
                                    address={addr.address}
                                    bounceable={addr.isBounceable}
                                />
                            </Text>
                        </>
                    )
                        : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text
                                    style={{ color: theme.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600' }}
                                    ellipsizeMode={'middle'}
                                    numberOfLines={1}
                                >
                                    <AddressComponent
                                        address={addr.address}
                                        bounceable={addr.isBounceable}
                                    />
                                </Text>
                                {isSpam && (
                                    <View style={{
                                        backgroundColor: theme.backgroundPrimaryInverted,
                                        borderRadius: 100,
                                        height: 15,
                                        marginLeft: 10,
                                        paddingHorizontal: 5,
                                        justifyContent: 'center',
                                    }}>
                                        <Text style={{
                                            fontSize: 10,
                                            fontWeight: '500',
                                            color: theme.textPrimaryInverted
                                        }}>
                                            {'SPAM'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )
                    }
                </View>
            </Animated.View>
        </Pressable>
    );
});