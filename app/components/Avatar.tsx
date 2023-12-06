import * as React from 'react';
import { Image } from 'react-native';
import { avatarHash } from '../utils/avatarHash';
import { KnownWallets } from '../secure/KnownWallets';
import { KnownAvatar } from './KnownAvatar';
import FastImage from 'react-native-fast-image';
import { memo } from 'react';
import { PerfText } from './basic/PerfText';
import { PerfView } from './basic/PerfView';
import { ThemeType } from '../engine/state/theme';

export const avatarImages = [
    require('@assets/avatars/0.webp'),
    require('@assets/avatars/1.webp'),
    require('@assets/avatars/2.webp'),
    require('@assets/avatars/3.webp'),
    require('@assets/avatars/4.webp'),
    require('@assets/avatars/5.webp'),
    require('@assets/avatars/6.webp'),
    require('@assets/avatars/7.webp'),
    require('@assets/avatars/8.webp'),
    require('@assets/avatars/9.webp'),
    require('@assets/avatars/10.webp'),
    require('@assets/avatars/11.webp'),
    require('@assets/avatars/12.webp'),
    require('@assets/avatars/13.webp'),
    require('@assets/avatars/14.webp'),
    require('@assets/avatars/15.webp'),
    require('@assets/avatars/16.webp'),
    require('@assets/avatars/17.webp'),
    require('@assets/avatars/18.webp'),
    require('@assets/avatars/19.webp'),
    require('@assets/avatars/20.webp'),
    require('@assets/avatars/21.webp'),
    require('@assets/avatars/22.webp'),
    require('@assets/avatars/23.webp'),
    require('@assets/avatars/24.webp'),
    require('@assets/avatars/25.webp'),
    require('@assets/avatars/26.webp'),
    require('@assets/avatars/27.webp'),
    require('@assets/avatars/28.webp'),
    require('@assets/avatars/29.webp'),
    require('@assets/avatars/30.webp'),
    require('@assets/avatars/31.webp'),
];

const myWalletSource = require('@assets/ic-my-wallet.png');
const verifiedSource = require('@assets/ic-verified.png');
const contactSource = require('@assets/ic-contact.png');

export const avatarColors = [
    '#294659',
    '#e56555',
    '#f28c48',
    '#8e85ee',
    '#76c84d',
    '#5fbed5',
    '#549cdd',
    '#f2749a',
    '#d1b04d'
];

export const Avatar = memo((props: {
    size: number,
    id: string,
    hash?: number | null,
    address?: string,
    image?: string,
    spam?: boolean,
    showSpambadge?: boolean,
    markContact?: boolean,
    verified?: boolean,
    dontShowVerified?: boolean,
    borderColor?: string,
    borderWith?: number,
    backgroundColor?: string,
    isOwn?: boolean,
    icBorderWidth?: number,
    icPosition?: 'top' | 'bottom' | 'left' | 'right',
    icBackgroundColor?: string,
    theme: ThemeType, 
    isTestnet: boolean,
}) => {
    const theme = props.theme;
    const isTestnet = props.isTestnet;

    let known = props.address ? KnownWallets(isTestnet)[props.address] : undefined;

    const hash = (props.hash !== undefined && props.hash !== null)
        ? props.hash
        : avatarHash(props.id, avatarImages.length);
    let imgSource = avatarImages[hash];
    let color = avatarColors[avatarHash(props.id, avatarColors.length)];
    let img: any;

    if (props.image) {
        img = (
            <FastImage
                source={{ uri: props.image }}
                style={{ width: props.size, height: props.size, borderRadius: props.size / 2, overflow: 'hidden' }}
            />
        );
    } else if (!known || (!known.ic) && imgSource) {
        img = (
            <FastImage
                source={imgSource}
                style={{ width: props.size * .83, height: props.size * .83, borderRadius: props.size / 2, overflow: 'hidden' }}
            />
        );
    } else {
        img = <KnownAvatar size={props.size} wallet={known} />;
    }

    let backgroundColor: string | undefined = props.backgroundColor ?? theme.surfaceOnElevation;

    if (known && known?.ic) {
        backgroundColor = theme.white;
    }

    let icSize = Math.floor(props.size * 0.43);
    let icPosition: {} = { bottom: -2, right: -2 };
    let spam = props.showSpambadge && props.spam;
    switch (props.icPosition) {
        case 'top':
            icPosition = { top: -icSize / 2 };
            break;
        case 'left':
            icPosition = { bottom: -2, left: -2 };
            break;
        case 'right':
            icPosition = { bottom: -2, right: -2 };
            break;
        case 'bottom':
            icPosition = { bottom: -icSize / 2 };
            break;
    }
    let ic = null;
    if (props.markContact) {
        let icOutline = Math.round(icSize * 0.03) > 2 ? Math.round(icSize * 0.03) : 2;
        if (props.icBorderWidth) {
            icOutline = props.icBorderWidth;
        }
        ic = (
            <PerfView style={[
                {
                    justifyContent: 'center', alignItems: 'center',
                    height: icSize, width: icSize,
                    borderRadius: icSize / 2,
                    backgroundColor: props.icBackgroundColor ?? theme.surfaceOnElevation,
                    position: 'absolute',
                },
                icPosition
            ]}>
                <Image
                    source={contactSource}
                    style={{
                        width: icSize - icOutline,
                        height: icSize - icOutline,
                        tintColor: theme.iconPrimary
                    }}
                />
            </PerfView>
        );
    } else if ((!!known || props.verified) && !props.dontShowVerified && !spam) {
        ic = (
            <PerfView style={[{
                position: 'absolute',
                justifyContent: 'center', alignItems: 'center',
                width: icSize, height: icSize, borderRadius: icSize,
                backgroundColor: props.icBackgroundColor ?? theme.surfaceOnElevation
            }, icPosition]}>
                <Image
                    source={verifiedSource}
                    style={{ height: icSize, width: icSize }}
                />
            </PerfView>
        );
    }

    if (props.isOwn) {
        ic = (
            <PerfView style={[
                {
                    justifyContent: 'center', alignItems: 'center',
                    height: icSize, width: icSize,
                    borderRadius: Math.round(icSize / 4),
                    backgroundColor: props.icBackgroundColor ?? theme.surfaceOnElevation,
                    position: 'absolute',
                },
                icPosition
            ]}>
                <Image
                    source={myWalletSource}
                    style={{
                        width: icSize,
                        height: icSize,
                        tintColor: theme.iconPrimary
                    }}
                />
            </PerfView>
        );
    }

    if (spam) {
        ic = null;
    }

    return (
        <PerfView>
            <PerfView style={{
                width: props.size,
                height: props.size,
                borderRadius: props.size / 2,
                backgroundColor: backgroundColor,
                borderColor: props.borderColor ?? color,
                borderWidth: props.borderWith !== undefined ? props.borderWith : 1,
                alignItems: 'center', justifyContent: 'center',
            }}>
                <PerfView style={{ opacity: props.spam ? .5 : 1 }}>
                    {img}
                </PerfView>
                {ic}
            </PerfView>
            {spam && (
                <PerfView style={{ borderRadius: 100, padding: 2, backgroundColor: theme.surfaceOnElevation }}>
                    <PerfView style={{
                        backgroundColor: theme.backgroundPrimaryInverted,
                        borderRadius: 100,
                        height: 15,
                        paddingHorizontal: 5,
                        justifyContent: 'center',
                        alignItems: 'center',
                        alignSelf: 'center',
                        position: 'absolute', bottom: 0,
                        width: 40,
                    }}>
                        <PerfText style={{
                            fontSize: 10,
                            fontWeight: '500',
                            color: theme.textPrimaryInverted,
                            flexShrink: 1
                        }}>
                            {'SPAM'}
                        </PerfText>
                    </PerfView>
                </PerfView>
            )}
        </PerfView>
    );
});
Avatar.displayName = 'AvatarView';