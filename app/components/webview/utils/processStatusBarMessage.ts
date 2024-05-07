import { StatusBarStyle } from "expo-status-bar";
import { warn } from "../../../utils/log";
import { Platform } from "react-native";

export function processStatusBarMessage(
    parsed: any,
    setStatusBarStyle: (style: StatusBarStyle) => void,
    setStatusBarBackgroundColor: (backgroundColor: string, animated: boolean) => void
) {
    if (typeof parsed.data.name === 'string' && (parsed.data.name as string).startsWith('status-bar.')) {
        const actionType = parsed.data.name.split('.')[1];

        switch (actionType) {
            case 'setStatusBarStyle':
                const style = parsed.data.args[0];
                if (style === 'dark') {
                    setStatusBarStyle('dark');
                } else if (style === 'light') {
                    setStatusBarStyle('light');
                } else {
                    warn('Invalid status bar style');
                }
                break;
            case 'setStatusBarBackgroundColor':
                if (Platform.OS !== 'android') {
                    return true;
                }
                const backgroundColor = parsed.data.args[0];
                if (Platform.OS === 'android') {
                    setStatusBarBackgroundColor(backgroundColor, true);
                }
                break;
            default:
                warn('Invalid status bar action type');
        }
        return true;
    }
    return false;
}