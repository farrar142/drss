import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

const instance = axios.create({
  // baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰 자동 추가
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 에러 처리
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 토큰 만료 시 토큰 제거 (리디렉션은 컴포넌트에서 처리)
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export function axiosInstance<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance(config).then(response => response.data).catch(error => {
    return Promise.reject(error);
  });
}
