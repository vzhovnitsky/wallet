import { memo } from "react";
import { ThemeType } from "../../../engine/state/theme";
import { PendingTransactionAvatar } from "../../../components/avatar/PendingTransactionAvatar";
import { WalletSettings } from "../../../engine/state/walletSettings";
import { Avatar } from "../../../components/avatar/Avatar";
import { KnownWallet } from "../../../secure/KnownWallets";

export const TxAvatar = memo((
    {
        status,
        parsedAddressFriendly,
        kind,
        spam,
        isOwn,
        theme,
        isTestnet,
        walletSettings,
        markContact,
        avatarColor,
        knownWallets
    }: {
        status: "failed" | "pending" | "success",
        parsedAddressFriendly: string,
        kind: "in" | "out",
        spam: boolean,
        isOwn: boolean,
        theme: ThemeType,
        isTestnet: boolean,
        walletSettings?: WalletSettings,
        markContact?: boolean,
        avatarColor: string,
        knownWallets: { [key: string]: KnownWallet }
    }
) => {
    if (status === "pending") {
        return (
            <PendingTransactionAvatar
                kind={kind}
                address={parsedAddressFriendly}
                avatarId={parsedAddressFriendly}
                knownWallets={knownWallets}
            />
        );
    }

    return (
        <Avatar
            size={48}
            address={parsedAddressFriendly}
            id={parsedAddressFriendly}
            borderWith={0}
            spam={spam}
            markContact={markContact}
            icProps={{
                isOwn,
                backgroundColor: theme.backgroundPrimary,
                size: 18,
                borderWidth: 2
            }}
            theme={theme}
            isTestnet={isTestnet}
            knownWallets={knownWallets}
            backgroundColor={avatarColor}
            hash={walletSettings?.avatar}
        />
    );
});