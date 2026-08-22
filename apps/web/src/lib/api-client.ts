import axios from 'axios';
import { toCamelCase, toSnakeCase } from '@grocery-delivery/utils';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  if (config.data && typeof config.data === 'object') {
    config.data = toSnakeCase(config.data);
  }
  return config;
});

apiClient.interceptors.response.use((response) => {
  if (response.data && typeof response.data === 'object') {
    response.data = toCamelCase(response.data);
  }
  return response;
});
