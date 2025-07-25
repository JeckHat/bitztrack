import { ChevronLeftIcon } from "@assets/icons";
import Images from "@assets/images";
import { Button, CustomText } from "@components";
import { TOKENLIST } from "@constants";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { delimiterFormat } from "@helpers";
import { NavigationContainer, NavigationIndependentTree, ParamListBase, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { createStackNavigator, TransitionPresets, StackNavigationOptions } from "@react-navigation/stack";
import { Colors, Fonts } from "@styles";
import { useMemo } from "react";
import { Image, TouchableHighlight, View } from "react-native";

const Stack = createStackNavigator()

function SelectToken(props: { tokenData: any }) {
    const tokenList = Object.keys(props.tokenData).filter((token) => props.tokenData[token]?.balance !== 0)
    const { navigate } = useNavigation()
    return (
        <BottomSheetView
            style={{ height: '100%', width: '100%', backgroundColor: Colors.baseComponent }}
        >
            <View className="items-center mb-4">
                <ChevronLeftIcon
                    style={{ position: 'absolute', left: 10, top: 1, bottom: 0 }}
                    width={24} height={24}
                    color={Colors.primary}
                />
                <CustomText
                    className="text-primary font-PlusJakartaSansSemiBold text-lg"
                >
                    Select Token
                </CustomText>
            </View>
            {tokenList.map((token, idx) => (
                <TouchableHighlight
                    key={`List-token-send-${idx}`}
                    onPress={() => {
                        navigate('SelectRecipient', {
                            mintAddress: token
                        })
                        // props.onSelectToken(token)
                        // props.hideModal()
                    }}
                >
                <View className="flex-row items-center px-3 mb-2" >
                    <Image
                        className="w-10 h-10 rounded-full mr-2"
                        source={Images[TOKENLIST[token].image as keyof typeof Images]}
                    />
                    <View className="flex-1 mb-1">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {TOKENLIST[token].name}
                        </CustomText>
                        <CustomText className="text-primary text-sm font-PlusJakartaSans">
                            {`${props.tokenData[token]?.balance ?? 0} ${TOKENLIST[token].ticker}`}
                        </CustomText>
                    </View>
                    <CustomText className="font-LatoBold text-md text-primary">
                        ${delimiterFormat(((props.tokenData[token]?.price ?? 0.0) * (props.tokenData[token]?.balance ?? 0)).toFixed(5))}
                    </CustomText>
                </View>
                </TouchableHighlight>
            ))}
            {/* <Button
                className="bg-red-200"
                title={"ada"}
                onPress={() => navigate('SelectRecipient')}
            /> */}
        </BottomSheetView>
    )
}

type ParamsType = {
    mintAddress?: string
}

function SelectRecipient() {
    const { goBack } = useNavigation()
    const { params } = useRoute<RouteProp<{ params?: { mintAddress?: string} }>>()
    return (
        <BottomSheetView
            style={{ height: '100%', width: '100%', backgroundColor: Colors.baseComponent }}
        >
            <View className="items-center mb-4">
                <ChevronLeftIcon
                    style={{ position: 'absolute', left: 10, top: 1, bottom: 0 }}
                    width={24} height={24}
                    color={Colors.primary}
                    onPress={goBack}
                />
                <CustomText
                    className="text-primary font-PlusJakartaSansSemiBold text-lg"
                >
                    Select Recipient
                </CustomText>
            </View>
            <CustomText className="text-primary">{params?.mintAddress ?? "asd"}</CustomText>
        </BottomSheetView>
    )
}

export function SendModalNavigation(props: { tokenData: any }) {
    const screenOptions = useMemo<StackNavigationOptions>(
        () => ({
            ...TransitionPresets.SlideFromRightIOS,
            headerMode: 'float',
            headerShown: false,
            headerTitleStyle: {
                fontFamily: Fonts.PlusJakartaSansSemiBold,
                fontSize: 12
            },
            safeAreaInsets: { top: 0 },
            headerShadowVisible: false,
            headerStyle: {},
            cardStyle: {
                backgroundColor: Colors.baseComponent,
                // overflow: 'visible',
            }
        }),
        []
    )
    return (
        <NavigationIndependentTree>
            <NavigationContainer>
                <Stack.Navigator screenOptions={screenOptions}>
                    <Stack.Screen
                        name="SelectToken"
                        component={() => <SelectToken tokenData={props.tokenData} />}
                    />
                    <Stack.Screen
                        name="SelectRecipient"
                        component={SelectRecipient}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </NavigationIndependentTree>
    )
}