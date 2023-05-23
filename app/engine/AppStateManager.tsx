import React from "react";
import { AppState, getAppState, setAppState as storeAppState } from "../storage/appState";
import { useAppConfig } from "../utils/AppConfigContext";
import { mixpanelFlush, mixpanelIdentify } from "../analytics/mixpanel";
import { createEngine } from "./createEngine";
import { EngineContext } from "./Engine";
import { useRecoilCallback } from "recoil";
import { useReboot } from "../utils/RebootContext";
import * as Application from 'expo-application';
import { storage } from "../storage/storage";
import { passcodeEncKey, passcodeSaltKey, passcodeStateKey } from "../storage/secureStorage";
import { warn } from "../utils/log";

export type AppStateManager = {
    updateAppState: (state: AppState) => void,
    current: AppState
}

export const AppStateManagerContext = React.createContext<AppStateManager | null>(null);

export const AppStateManagerLoader = React.memo(({ children }: { children?: any }) => {
    const { AppConfig } = useAppConfig();
    const reboot = useReboot()
    const recoilUpdater = useRecoilCallback<[any, any], any>(({ set }) => (node, value) => set(node, value));

    const initAppState = React.useMemo(() => {
        const storedAppState = getAppState();
        if (!storedAppState) {
            return { state: { addresses: [], selected: -1 }, engine: null };
        }

        // TODO REMOVE THIS BEFORE PR INTO DEV UPSTREAM
        if (Application.applicationId?.includes('demo')) {
            try {
                const prevKey = storage.getString(passcodeEncKey);
                const prevPasscodeState = storage.getString(passcodeStateKey);
                const prevSalt = storage.getString(passcodeSaltKey);
                const acc = storedAppState.addresses[storedAppState.selected];
                if (prevKey && prevPasscodeState && prevSalt && acc) {
                    storage.set(`${acc.address.toFriendly({ testOnly: AppConfig.isTestnet })}/${passcodeSaltKey}`, prevSalt);
                    storage.set(`${acc.address.toFriendly({ testOnly: AppConfig.isTestnet })}/${passcodeEncKey}`, prevKey);
                    storage.set(`${acc.address.toFriendly({ testOnly: AppConfig.isTestnet })}/${passcodeStateKey}`, prevPasscodeState);
                }
                storage.delete(passcodeEncKey);
                storage.delete(passcodeSaltKey);
                storage.delete(passcodeStateKey);
            } catch (e) {
                warn('Failed to migrate passcode');
            }
        }

        if (storedAppState.selected !== -1 && storedAppState.selected < storedAppState.addresses.length) {
            const ex = storedAppState.addresses[storedAppState.selected];

            // Identify user profile by address
            mixpanelIdentify(ex.address.toFriendly({ testOnly: AppConfig.isTestnet }));
            mixpanelFlush(AppConfig.isTestnet);

            return {
                state: storedAppState,
                engine: createEngine({ address: ex.address, publicKey: ex.publicKey, utilityKey: ex.utilityKey, recoilUpdater, isTestnet: AppConfig.isTestnet })
            }
        } else {
            return { state: storedAppState, engine: null };
        }
    }, []);

    const [appState, setAppState] = React.useState(initAppState);

    const onAppStateUpdate = React.useCallback((newState: AppState) => {
        if (newState.selected !== undefined && newState.selected < newState.addresses.length) {
            storeAppState(newState, AppConfig.isTestnet);
            if (newState.selected === -1) {
                appState.engine?.destroy();
                setAppState({ state: newState, engine: null });
                return;
            }
            if (newState.selected !== appState.state.selected) {
                appState.engine?.destroy();
                const ex = newState.addresses[newState.selected];
                mixpanelIdentify(ex.address.toFriendly({ testOnly: AppConfig.isTestnet }));
                mixpanelFlush(AppConfig.isTestnet);

                const storedAppState = getAppState();
                const engine = createEngine({ address: ex.address, publicKey: ex.publicKey, utilityKey: ex.utilityKey, recoilUpdater, isTestnet: AppConfig.isTestnet });

                setAppState({ state: storedAppState, engine });
            }
        }
        reboot();

    }, [appState, AppConfig.isTestnet]);


    React.useEffect(() => {
        return () => {
            if (initAppState.engine) {
                initAppState.engine.destroy();
            }
        }
    }, []);

    return (
        <AppStateManagerContext.Provider value={{ updateAppState: onAppStateUpdate, current: appState.state }}>
            <EngineContext.Provider value={appState.engine}>
                {children}
            </EngineContext.Provider>
        </AppStateManagerContext.Provider>
    );
});

export function useAppStateManager() {
    const ctx = React.useContext(AppStateManagerContext);
    if (!ctx) {
        throw new Error('AppStateManagerContext not initialized');
    }
    return ctx;
}