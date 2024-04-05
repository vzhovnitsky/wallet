import { StatusBar } from "expo-status-bar";
import { fragment } from "../../fragment";
import { Linking, Platform, View } from "react-native";
import { useBounceableWalletFormat, useNetwork, usePrice, useTheme } from "../../engine/hooks";
import { useCallback, useMemo, useRef } from "react";
import { getPlatform } from "../../engine/tonconnect/config";
import { tonhubBridgeSource } from "../apps/components/inject/createInjectSource";
import { getCurrentAddress } from "../../storage/appState";
import { useTonhubBridgeEngine } from "../apps/components/inject/useInjectEngine";
import { usePermissions } from "expo-notifications";
import i18n from 'i18next';
import { extractDomain } from "../../engine/utils/extractDomain";
import { useLinkNavigator } from "../../useLinkNavigator";
import { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { resolveUrl } from "../../utils/resolveUrl";
import { protectNavigation } from "../apps/components/protect/protectNavigation";
import { DAppWebView } from "../../components/webview/DAppWebView";
import WebView from "react-native-webview";
import { SwapSkeleton } from "../../components/skeletons/SwapSkeleton";
import { useTrackScreen } from "../../analytics/mixpanel";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const SwapFragment = fragment(() => {
    const theme = useTheme();
    const safeArea = useSafeAreaInsets();
    const { isTestnet } = useNetwork();
    const [bounceableFormat,] = useBounceableWalletFormat();
    const [pushPemissions,] = usePermissions();
    const [, currency] = usePrice();

    const webViewRef = useRef<WebView>(null);

    // const deDustUrl = isTestnet ? 'https://dev.dedust-tonhub.pages.dev/' : 'https://dedust-tonhub.pages.dev/';
    // TODO: Change to production
    const deDustUrl = 'https://dev.dedust-tonhub.pages.dev/';
    const domain = extractDomain(deDustUrl);
    const endpoint = useMemo(() => {
        try {
            const selected = getCurrentAddress();
            const pushNotifications = pushPemissions?.granted && pushPemissions?.status === 'granted';

            const source = new URL(deDustUrl);

            source.searchParams.set('address', encodeURIComponent(selected.addressString));
            source.searchParams.set('utm_source', 'tonhub');
            source.searchParams.set('utm_content', 'extension');
            source.searchParams.set('ref', 'tonhub');
            source.searchParams.set('lang', i18n.language);
            source.searchParams.set('currency', currency);
            source.searchParams.set('themeStyle', theme.style === 'dark' ? 'dark' : 'light');
            source.searchParams.set('pushNotifications', pushNotifications ? 'true' : 'false');

            return source.toString();
        } catch {
            return deDustUrl;
        }
    }, [pushPemissions, currency, theme.style]);

    const bridgeEngine = useTonhubBridgeEngine(domain, 'DeDust.io', isTestnet, endpoint);
    const linkNavigator = useLinkNavigator(isTestnet);
    const loadWithRequest = useCallback((event: ShouldStartLoadRequest): boolean => {
        try {
            new URL(event.url);
            new URL(endpoint);
        } catch (error) {
            return false;
        }
        if (extractDomain(event.url) === extractDomain(endpoint)) {
            return true;
        }

        // Resolve internal url
        const resolved = resolveUrl(event.url, isTestnet);
        if (resolved) {
            linkNavigator(resolved);
            return false;
        }

        // Secondary protection
        let prt = protectNavigation(event.url, endpoint);
        if (prt) {
            return true;
        }

        // Resolve linking
        Linking.openURL(event.url);
        return false;
    }, [endpoint, linkNavigator]);

    const webViewProps = useMemo(() => {
        const devicePlatform = getPlatform();

        let platform = 'other';
        if (devicePlatform === 'android') {
            platform = 'android';
        } else if (devicePlatform === 'iphone') {
            platform = 'ios';
        }

        const injectionSource = tonhubBridgeSource({
            platform,
            wallet: {
                address: getCurrentAddress().address.toString({ testOnly: isTestnet, bounceable: bounceableFormat }),
                publicKey: getCurrentAddress().publicKey.toString('base64'),
            },
            version: 1,
            network: isTestnet ? 'testnet' : 'mainnet',
            theme: theme.style === 'dark' ? 'dark' : 'light'
        });

        return {
            injectedJavaScriptBeforeContentLoaded: injectionSource,
            injectionEngine: bridgeEngine,
            useStatusBar: true,
            // useMainButton,
            useToaster: true,
            useQueryAPI: true,
            onShouldStartLoadWithRequest: loadWithRequest
        }
    }, [theme, isTestnet, bridgeEngine, loadWithRequest, bounceableFormat]);

    useTrackScreen('Swap', isTestnet);

    return (
        <View style={{
            flexGrow: 1,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            overflow: 'hidden',
        }}>
            <StatusBar
                style={Platform.select({
                    android: theme.style === 'dark' ? 'light' : 'dark',
                    ios: 'light'
                })}
            />
            <DAppWebView
                ref={webViewRef}
                source={{ uri: endpoint }}
                {...webViewProps}
                webviewDebuggingEnabled={isTestnet}
                onContentProcessDidTerminate={webViewRef.current?.reload}
                loader={(l) => <SwapSkeleton loaded={l.loaded} theme={theme} />}
                defaultSafeArea={Platform.OS === 'ios' ? { bottom: safeArea.bottom - 8 } : { top: 16, bottom: 0 }}
            />
        </View>
    );
});