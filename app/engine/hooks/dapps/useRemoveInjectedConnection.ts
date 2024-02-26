import { getCurrentAddress } from "../../../storage/appState";
import { useConnectExtensions } from "../../hooks/dapps/useTonConnectExtenstions";
import { TonConnectBridgeType } from '../../tonconnect/types';
import { extensionKey } from "./useAddExtension";
import { useSetAppsConnectionsState } from "./useSetTonconnectConnections";

export function useRemoveInjectedConnection() {
    const [extensions,] = useConnectExtensions();
    const setConnections = useSetAppsConnectionsState();

    return (endpoint: string) => {
        let key = extensionKey(endpoint);

        const app = extensions[key];
        if (!app) {
            return;
        }

        const currentAccount = getCurrentAddress();

        setConnections(
            currentAccount.addressString,
            (prev) => {
                prev[key] = (prev[key] ?? []).filter((item) => item.type !== TonConnectBridgeType.Injected);
                return prev;
            }
        );
    }
}