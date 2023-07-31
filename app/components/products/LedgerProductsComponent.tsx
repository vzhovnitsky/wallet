import BN from "bn.js"
import React, { useLayoutEffect, useMemo } from "react"
import { LayoutAnimation, Pressable, Text, View } from "react-native"
import OldWalletIcon from '../../../assets/ic_old_wallet.svg';
import SignIcon from '../../../assets/ic_sign.svg';
import TransactionIcon from '../../../assets/ic_transaction.svg';
import { AnimatedProductButton } from "./AnimatedProductButton"
import { FadeInUp, FadeOutDown } from "react-native-reanimated"
import { HoldersProductButton } from "./HoldersProductButton"
import { useEngine } from "../../engine/Engine";
import { prepareTonConnectRequest, tonConnectTransactionCallback } from "../../engine/tonconnect/utils";
import { extractDomain } from "../../engine/utils/extractDomain";
import { getConnectionReferences } from "../../storage/appState";
import { useAppConfig } from "../../utils/AppConfigContext";
import { useTypedNavigation } from "../../utils/useTypedNavigation";
import { StakingProductComponent } from "./StakingProductComponent";
import { t } from "../../i18n/t";
import { JettonsProductComponent } from "./JettonsProductComponent";
import { LedgerStakingProductComponent } from "./LedgerStakingProductComponent";
import { LedgerJettonsProductComponent } from "./LedgerJettonsProductComponent";
import { useLedgerTransport } from "../../fragments/ledger/components/LedgerTransportProvider";
import { Address } from "ton";

export const LedgerProductsComponent = React.memo(() => {
    const { Theme, AppConfig } = useAppConfig();
    const navigation = useTypedNavigation();
    const engine = useEngine();

    return (
        <View style={{ paddingHorizontal: 16 }}>
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between', alignItems: 'center',
                marginTop: 16,
                paddingVertical: 12,
                marginBottom: 4
            }}>
                <Text style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: Theme.textColor,
                    lineHeight: 24,
                }}>
                    {t('common.products')}
                </Text>
            </View>

            <View style={{ marginTop: 8 }}>
                <LedgerStakingProductComponent key={'pool'} />
            </View>

            <View style={{ marginTop: 8 }}>
                <LedgerJettonsProductComponent key={'jettons'} />
            </View>
        </View>
    )
})