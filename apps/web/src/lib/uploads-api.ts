import { apiClient } from './api-client';

export type UploadFolder = 'categories' | 'products';

export const uploadsApi = {
  uploadImage: (file: Blob, folder: UploadFolder) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<{ url: string }>(`/uploads/image?type=${folder}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data.url);
  },
};
