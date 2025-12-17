import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@drss_server_url';

export default function App() {
  const [serverUrl, setServerUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // 저장된 URL 불러오기
  useEffect(() => {
    loadSavedUrl();
  }, []);

  // Android 뒤로가기 처리
  useEffect(() => {
    if (!isConnected) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isConnected]);

  const loadSavedUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedUrl) {
        setInputUrl(savedUrl);
      }
    } catch (error) {
      console.error('Failed to load saved URL:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUrl = async (url: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, url);
    } catch (error) {
      console.error('Failed to save URL:', error);
    }
  };

  const handleConnect = () => {
    let url = inputUrl.trim();

    // URL 형식 보정
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // 마지막 슬래시 제거
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    setServerUrl(url);
    saveUrl(url);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setServerUrl('');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (isConnected && serverUrl) {
    return (
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* WebView - Safe Area 적용 */}
        <WebView
          ref={webViewRef}
          source={{ uri: serverUrl }}
          style={styles.fullScreenWebView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsBackForwardNavigationGestures={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>로딩 중...</Text>
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* 로고/타이틀 */}
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>📰</Text>
            <Text style={styles.title}>DRSS</Text>
            <Text style={styles.subtitle}>RSS Reader</Text>
          </View>

          {/* 입력 폼 */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>서버 주소</Text>
            <TextInput
              style={styles.input}
              placeholder="예: https://your-server.com"
              placeholderTextColor="#666"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleConnect}
            />

            <TouchableOpacity
              style={[styles.button, !inputUrl.trim() && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={!inputUrl.trim()}
            >
              <Text style={styles.buttonText}>연결하기</Text>
            </TouchableOpacity>
          </View>

          {/* 안내 문구 */}
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              DRSS 서버의 주소를 입력하세요.{'\n'}
              로컬 개발 시: http://localhost:3000
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#3a3a5a',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#3b82f680',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // WebView 스타일
  webViewContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  headerUrl: {
    flex: 1,
    color: '#888',
    fontSize: 12,
    marginLeft: 12,
  },
  webView: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenWebView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
});
