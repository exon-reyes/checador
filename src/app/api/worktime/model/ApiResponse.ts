// Estructura para una respuesta exitosa
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
}
// Estructura para una respuesta de error
interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
