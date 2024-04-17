ВТОРОЙ
import { memo } from "react";
import { View, Image, Pressable, Text } from "react-native";
import { Jetton } from "../../engine/types";
import { useIsScamJetton } from "../../engine/hooks";
import { WImage } from "../WImage";
import { ThemeType } from "../../engine/state/theme";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Typography } from "../styles";
import { KnownJettonMasters } from "../../secure/KnownWallets";

import IcCheck from "@assets/ic-check.svg";

export const AssetsListItem = memo(({
    jetton,
    onSelect,
    theme,
    selected,
    hideSelection,
    isTestnet
}: {
    jetton: Jetton,
    onSelect: (j: Jetton) => void,
    theme: ThemeType,
    selected?: boolean,
    hideSelection?: boolean,
    isTestnet: boolean
}) => {
    const verified = KnownJettonMasters(isTestnet)[jetton.master.toString()];
    const isSCAM = useIsScamJetton(jetton.symbol, jetton.master.toString({ testOnly: isTestnet }));

    return (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Pressable
                style={{
                    backgroundColor: theme.surfaceOnElevation,
                    padding: 20,
                    marginBottom: 16,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
                onPress={() => onSelect(jetton)}
            >
                <View style={{ height: 46, width: 46, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    {!!icon ? (icon) : (
                        <View style={{ width: 46, height: 46 }}>
                            <WImage
                                src={jetton.icon ? jetton.icon : undefined}
                                width={46}
                                heigh={46}
                                borderRadius={23}
                            />
                            {verified ? (
                                <View style={{
                                    justifyContent: 'center', alignItems: 'center',
                                    height: 20, width: 20, borderRadius: 10,
                                    position: 'absolute', right: -2, bottom: -2,
                                    backgroundColor: theme.surfaceOnBg
                                }}>
                                    <Image
                                        source={require('@assets/ic-verified.png')}
                                        style={{ height: 20, width: 20 }}
                                    />
                                </View>
                            </View>
                        }
                        selected={!selectedJetton}
                        hideSelection={!callback}
                    />
                    {(isLedgerScreen ? ledgerJettons : visibleList).map((j) => {
                        const selected = !!selectedJetton && j.master.equals(selectedJetton);
                        return (
                            <AssetsListItem
                                key={'jt' + j.wallet.toString()}
                                jetton={j}
                                onSelect={() => onSelected(j)}
                                theme={theme}
                                hideSelection={!callback}
                                selected={selected}
                                isTestnet={network.isTestnet}
                            />
                        );
                    })}
                </View>
                <View style={{ justifyContent: 'center', flexGrow: 1, flex: 1 }}>
                    <Text style={[{ flexShrink: 1, color: theme.textPrimary, marginBottom: 2 }, Typography.semiBold17_24]}>
                        {jetton.name}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={{
                            flexShrink: 1,
                            fontSize: 15, lineHeight: 20, fontWeight: '400',
                            color: theme.textSecondary,
                        }}
                    >
                        {isSCAM && (
                            <>
                                <Text style={{ color: theme.accentRed }}>
                                    {'SCAM'}
                                </Text>
                                {jetton.description ? ' • ' : ''}
                            </>
                        )}
                        {jetton.description}
                    </Text>
                </View>
                {!hideSelection && (
                    <View style={{
                        justifyContent: 'center', alignItems: 'center',
                        height: 24, width: 24,
                        backgroundColor: selected ? theme.accent : theme.divider,
                        borderRadius: 12
                    }}>
                        {selected && (
                            <IcCheck
                                color={theme.white}
                                height={16} width={16}
                                style={{ height: 16, width: 16 }}
                            />
                        )}
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
});