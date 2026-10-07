import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const isWeb = typeof window !== "undefined";

export const Storage = {
    setToken: async (token: string) => {
        if (isWeb) {
            return localStorage.setItem("token", token);
        }
        return SecureStore.setItemAsync("token", token);
    },

    getToken: async () => {
        if (isWeb) {
            return localStorage.getItem("token");
        }
        return SecureStore.getItemAsync("token");
    },

    removeToken: async () => {
        if (isWeb) {
            return localStorage.removeItem("token");
        }
        return SecureStore.deleteItemAsync("token");
    },
};

export const UserStorage = {
    setUser: async (user: any) => {
        if (isWeb) {
            return localStorage.setItem("user", JSON.stringify(user));
        }
        return AsyncStorage.setItem("user", JSON.stringify(user));
    },

    getUser: async () => {
        if (isWeb) {
            const user = localStorage.getItem("user");
            return user ? JSON.parse(user) : null;
        }

        const user = await AsyncStorage.getItem("user");
        return user ? JSON.parse(user) : null;
    },
};