import { createContext, ReactNode, useCallback, useRef, useState } from "react"
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Colors } from "@styles";
import { View } from "react-native";

interface ModalContextType {
    showModal: (content?: ReactNode, cancelable?: boolean) => void;
    hideModal: () => void;
}

export const BottomModalContext = createContext<ModalContextType | undefined>(undefined)

type BottomModalProvider = {
    cancelable?: boolean
    children: ReactNode
}

export function BottomModalProvider(props: BottomModalProvider) {
    const { cancelable = true, children } = props

    const [modalContent, setModalContent] = useState<ReactNode>(null)

    const bottomSheetModalRef = useRef<BottomSheetModal>(null)

    const showModal = useCallback((content: ReactNode) => {
        setModalContent(content);
        bottomSheetModalRef.current?.present()
    }, [])

    const hideModal = useCallback(() => {
        bottomSheetModalRef.current?.dismiss()
    }, [])

    const renderbackdrop = useCallback((props: any) => (
        <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.9}
            pressBehavior="close"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
        />
    ), [])
    
    return (
        <BottomModalContext.Provider value={{ showModal, hideModal }}>
            <BottomSheetModalProvider>
                {children}
                <BottomSheetModal
                    backdropComponent={renderbackdrop}
                    containerStyle={{ padding: 0, paddingVertical: 0 }}
                    ref={bottomSheetModalRef}
                    index={0}
                    handleIndicatorStyle={{ backgroundColor: Colors.primary }}
                    snapPoints={['80%']}
                    backgroundStyle={{ backgroundColor: Colors.baseComponent }}
                    onDismiss={hideModal}
                    enableDismissOnClose={true}
                >
                    {modalContent}
                </BottomSheetModal>
            </BottomSheetModalProvider>
        </BottomModalContext.Provider>
    )
}