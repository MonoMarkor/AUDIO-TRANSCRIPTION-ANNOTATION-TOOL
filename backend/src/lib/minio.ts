import { Client } from 'minio'

export const minioClient = new Client({
  endPoint: 'minio',
  port: 9000,
  useSSL: false,
  accessKey: process.env.S3_ACCESS_KEY || '',
  secretKey: process.env.S3_SECRET_KEY || '',
})

export const BUCKET_NAME = process.env.MINIO_BUCKET || 'my-app-bucket'
