import {AfterViewInit, Component, ElementRef, HostListener, inject, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy, signal, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {catchError, finalize, Observable, of, Subject, takeUntil, retry, timeout, TimeoutError} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {WebcamImage, WebcamInitError, WebcamModule} from 'ngx-webcam';
import {WorktimeService} from './api/worktime/service/worktime.service';
import {Empleado} from './api/worktime/model/Empleado';
import {TipoPausa} from './api/worktime/model/TipoPausa';

export type Accion = 'iniciarJornada' | 'finalizarJornada' | 'iniciarPausa' | 'finalizarPausa';

interface ApiErrorResponse {
  message?: string;
}

interface ConfiguracionSistema {
  modoSinCamara: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, WebcamModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, AfterViewInit, OnDestroy {

  // ========== SIGNALS PARA MEJOR RENDIMIENTO ==========
  private readonly vistaActualSignal = signal<'reloj' | 'webcam' | 'empleado'>('reloj');
  private readonly empleadoSignal = signal<Empleado | null>(null);
  private readonly isLoadingSignal = signal(false);
  private readonly isUploadingSignal = signal(false);
  private readonly errorApiSignal = signal<string | null>(null);
  private readonly accionActualSignal = signal<Accion | null>(null);
  private readonly pausaActualSignal = signal<TipoPausa | null>(null);

  // Webcam signals
  private readonly fotoCapturadaSignal = signal<WebcamImage | null>(null);
  private readonly webcamErrorSignal = signal<string | null>(null);
  private readonly cameraPermissionGrantedSignal = signal(false);
  private readonly countdownSignal = signal<number | null>(null);

  // Clock signals
  private readonly fechaFormateadaSignal = signal('');
  private readonly horaFormateadaSignal = signal('');

  // Keypad signals
  private readonly valorIngresadoSignal = signal('');

  // UI signals
  private readonly showSuccessMessageSignal = signal(false);
  private readonly successMessageTextSignal = signal('');

  // Configuration signals
  private readonly configuracionSignal = signal<ConfiguracionSistema>(
    this.cargarConfiguracionDesdeStorage()
  );
  private readonly mostrarConfigSignal = signal(false);
  private readonly codigoConfigSignal = signal('');

  // ========== COMPUTED PROPERTIES ==========
  readonly vistaActual = this.vistaActualSignal.asReadonly();
  readonly empleado = this.empleadoSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly isUploading = this.isUploadingSignal.asReadonly();
  readonly errorApi = this.errorApiSignal.asReadonly();
  readonly accionActual = this.accionActualSignal.asReadonly();
  readonly pausaActual = this.pausaActualSignal.asReadonly();
  readonly fotoCapturada = this.fotoCapturadaSignal.asReadonly();
  readonly webcamError = this.webcamErrorSignal.asReadonly();
  readonly cameraPermissionGranted = this.cameraPermissionGrantedSignal.asReadonly();
  readonly countdown = this.countdownSignal.asReadonly();
  readonly fechaFormateada = this.fechaFormateadaSignal.asReadonly();
  readonly horaFormateada = this.horaFormateadaSignal.asReadonly();
  readonly valorIngresado = this.valorIngresadoSignal.asReadonly();
  readonly showSuccessMessage = this.showSuccessMessageSignal.asReadonly();
  readonly successMessageText = this.successMessageTextSignal.asReadonly();
  readonly configuracion = this.configuracionSignal.asReadonly();
  readonly mostrarConfig = this.mostrarConfigSignal.asReadonly();
  readonly codigoConfig = this.codigoConfigSignal.asReadonly();

  // Computed para máscara (evita recálculos innecesarios)
  readonly mascara = computed(() => '*'.repeat(this.valorIngresado().length));

  // ========== OPTIMIZACIONES DE RENDIMIENTO ==========
  private readonly trigger = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private capturaAutomaticaTimerId?: number;
  private countdownIntervalId?: number;
  private intervalId?: number;

  @ViewChild('codeInput') private codeInput!: ElementRef<HTMLInputElement>;
  private readonly checadorService = inject(WorktimeService);

  // Constantes estáticas para evitar recreación
  private static readonly MAX_LENGTH = 8;
  private static readonly TIMEOUT_MS = 10000; // 10s timeout
  private static readonly RETRY_COUNT = 2;
  private static readonly CODIGO_ADMIN = '1234'; // Código para activar modo sin cámara
  private static readonly FECHA_OPTIONS: Intl.DateTimeFormatOptions = Object.freeze({
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  private static readonly HORA_OPTIONS: Intl.DateTimeFormatOptions = Object.freeze({
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  // Memoización para formateo de fecha/hora
  private fechaCache = { date: '', formatted: '' };
  private horaCache = { time: '', formatted: '' };

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  async ngOnInit(): Promise<void> {
    this.actualizarFechaHora();
    this.intervalId = window.setInterval(() => this.actualizarFechaHora(), 1000);

    // Solo verificar permisos si no está en modo sin cámara
    if (!this.configuracionSignal().modoSinCamara) {
      await this.verificarPermisosCamara().catch(() => {
        console.warn('No se pudieron verificar permisos de cámara');
      });
    } else {
      // Si está en modo sin cámara, marcar como que no necesita permisos
      this.cameraPermissionGrantedSignal.set(true);
    }
  }

  ngAfterViewInit(): void {
    this.enfocarInputSiEsNecesario();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.limpiarTodosLosTimers();
  }

  // ========== OPTIMIZACIONES DE FECHA/HORA ==========
  private actualizarFechaHora(): void {
    const ahora = new Date();
    const fechaKey = ahora.toDateString();
    const horaKey = `${ahora.getHours()}:${ahora.getMinutes()}:${ahora.getSeconds()}`;

    // Cache para fecha (cambia menos frecuentemente)
    if (this.fechaCache.date !== fechaKey) {
      this.fechaCache.date = fechaKey;
      this.fechaCache.formatted = ahora.toLocaleDateString('es-ES', App.FECHA_OPTIONS);
      this.fechaFormateadaSignal.set(this.fechaCache.formatted);
    }

    // Cache para hora
    if (this.horaCache.time !== horaKey) {
      this.horaCache.time = horaKey;
      this.horaCache.formatted = ahora.toLocaleTimeString('es-ES', App.HORA_OPTIONS);
      this.horaFormateadaSignal.set(this.horaCache.formatted);
    }
  }

  // ========== OPTIMIZACIONES DE CÁMARA ==========
  private async verificarPermisosCamara(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });
      this.cameraPermissionGrantedSignal.set(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      this.cameraPermissionGrantedSignal.set(false);
      console.warn('Permisos de cámara no otorgados:', error);
    }
  }

  // ========== MÉTODOS DE TECLADO OPTIMIZADOS ==========
  agregarDigito(digito: number): void {
    const valorActual = this.valorIngresadoSignal();
    if (valorActual.length < App.MAX_LENGTH) {
      this.valorIngresadoSignal.set(valorActual + digito.toString());
    }
  }

  borrar(): void {
    const valorActual = this.valorIngresadoSignal();
    if (valorActual.length > 0) {
      this.valorIngresadoSignal.set(valorActual.slice(0, -1));
    }
    this.enfocarInputSiEsNecesario();
  }

  // Optimización: evitar regex en hot path
  @HostListener('window:keydown', ['$event'])
  manejarTeclaPresionada(evento: KeyboardEvent): void {
    if (this.vistaActualSignal() !== 'reloj') return;

    const tecla = evento.key;

    // Optimización: comparación directa más rápida que regex
    if (tecla >= '0' && tecla <= '9') {
      evento.preventDefault();
      this.agregarDigito(Number(tecla));
    } else if (tecla === 'Backspace') {
      evento.preventDefault();
      this.borrar();
    } else if (tecla === 'Enter') {
      evento.preventDefault();
      this.aceptar();
    }
  }

  // ========== AUTENTICACIÓN CON ALTA DISPONIBILIDAD ==========
  aceptar(): void {
    const valor = this.valorIngresadoSignal();
    if (valor.length === 0 || this.isLoadingSignal()) return;

    this.isLoadingSignal.set(true);
    this.errorApiSignal.set(null);

    this.checadorService.consultarEmpleadoPorNip(valor)
      .pipe(
        timeout(App.TIMEOUT_MS), // Timeout para evitar esperas infinitas
        retry(App.RETRY_COUNT), // Reintentos automáticos
        takeUntil(this.destroy$), // Cleanup automático
        catchError((error: HttpErrorResponse) => {
          console.error('Error en consulta:', error);
          this.errorApiSignal.set(this.obtenerMensajeErrorConsulta(error));
          return of(null);
        }),
        finalize(() => this.isLoadingSignal.set(false))
      )
      .subscribe(response => {
        this.valorIngresadoSignal.set('');
        if (response?.success) {
          this.empleadoSignal.set(response.data);
          this.vistaActualSignal.set('empleado');
        }
        this.enfocarInputSiEsNecesario();
      });
  }

  // ========== CAPTURA DE FOTO OPTIMIZADA ==========
  iniciarCapturaFoto(accion: Accion, tipoPausa?: TipoPausa): void {
    // Si está en modo sin cámara, procesar directamente
    if (this.configuracionSignal().modoSinCamara) {
      this.accionActualSignal.set(accion);
      this.pausaActualSignal.set(tipoPausa || null);
      this.procesarSinCamara();
      return;
    }

    // Código original para modo con cámara
    if (!this.cameraPermissionGrantedSignal()) {
      this.errorApiSignal.set('Se requieren permisos de cámara para continuar.');
      return;
    }

    this.accionActualSignal.set(accion);
    this.pausaActualSignal.set(tipoPausa || null);
    this.vistaActualSignal.set('webcam');
    this.resetearCamara();
    this.iniciarCuentaRegresiva();
  }

  private iniciarCuentaRegresiva(): void {
    this.countdownSignal.set(5);

    this.countdownIntervalId = window.setInterval(() => {
      const current = this.countdownSignal();
      if (current !== null && current > 0) {
        this.countdownSignal.set(current - 1);
      } else {
        this.countdownSignal.set(null);
        this.limpiarCountdownTimer();
      }
    }, 1000);

    this.capturaAutomaticaTimerId = window.setTimeout(() => {
      this.tomarFoto();
    }, 5000);
  }

  tomarFoto(): void {
    this.trigger.next();
  }

  handleImage(webcamImage: WebcamImage): void {
    this.limpiarTimers();
    this.fotoCapturadaSignal.set(webcamImage);
    this.procesarImagen(webcamImage);
  }

  // ========== PROCESAMIENTO DE IMAGEN CON ALTA DISPONIBILIDAD ==========
  private procesarImagen(webcamImage: WebcamImage): void {
    const empleado = this.empleadoSignal();
    const accion = this.accionActualSignal();

    if (!empleado || !accion) {
      this.errorApiSignal.set("Error: Faltan datos para procesar la solicitud.");
      return;
    }

    this.isUploadingSignal.set(true);
    this.errorApiSignal.set(null);

    const { apiCall, successMessage } = this.obtenerConfiguracionAccion(webcamImage);
    if (!apiCall) return;

    apiCall.pipe(
      timeout(App.TIMEOUT_MS * 2), // Más tiempo para upload
      retry(App.RETRY_COUNT),
      takeUntil(this.destroy$),
      finalize(() => this.isUploadingSignal.set(false)),
      catchError((error: HttpErrorResponse) => {
        console.error('Error en procesamiento:', error);
        this.errorApiSignal.set(this.obtenerMensajeErrorProcesamiento(error));
        return of(null);
      })
    ).subscribe(response => {
      if (response?.success) {
        this.mostrarMensajeExito(successMessage);
      }
    });
  }

  private obtenerConfiguracionAccion(webcamImage: WebcamImage): { apiCall: Observable<any> | null, successMessage: string } {
    const empleado = this.empleadoSignal()!;
    const accion = this.accionActualSignal()!;
    const pausa = this.pausaActualSignal();
    const foto = webcamImage.imageAsDataUrl;

    // Optimización: switch más eficiente que objeto lookup
    switch (accion) {
      case 'iniciarJornada':
        return {
          apiCall: this.checadorService.iniciarJornada(empleado.id, foto),
          successMessage: '¡Jornada iniciada con éxito!'
        };
      case 'finalizarJornada':
        return {
          apiCall: this.checadorService.finalizarJornada(empleado.id, foto),
          successMessage: '¡Jornada finalizada con éxito!'
        };
      case 'iniciarPausa':
        if (!pausa) return { apiCall: null, successMessage: '' };
        return {
          apiCall: this.checadorService.iniciarPausa(empleado.id, pausa, foto),
          successMessage: `¡Pausa de ${pausa} iniciada!`
        };
      case 'finalizarPausa':
        if (!pausa) return { apiCall: null, successMessage: '' };
        return {
          apiCall: this.checadorService.finalizarPausa(empleado.id, pausa, foto),
          successMessage: `¡Pausa de ${pausa} finalizada!`
        };
      default:
        this.errorApiSignal.set("Acción no reconocida.");
        return { apiCall: null, successMessage: '' };
    }
  }

  // ========== MANEJO DE ERRORES MEJORADO ==========
  private obtenerMensajeErrorConsulta(error: any): string {
    // Verificar si es un timeout error
    if (error instanceof TimeoutError) {
      return 'La consulta está tardando más de lo esperado. Verifica tu conexión.';
    }

    // Si es HttpErrorResponse
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No se puede conectar al servidor. Verifica tu conexión a internet o intente más tarde.';
      }
      if (error.status === 404) {
        return 'Usuario no encontrado. Verifica tu NIP.';
      }
      if (error.status >= 500) {
        return 'Error del servidor. Intenta nuevamente en unos momentos.';
      }

      const errorBody: ApiErrorResponse = error.error;
      return errorBody?.message || 'Error de conexión con el servidor.';
    }

    return 'Error inesperado. Inténtalo de nuevo.';
  }

  private obtenerMensajeErrorProcesamiento(error: any): string {
    // Verificar si es un timeout error
    if (error instanceof TimeoutError) {
      return 'El registro está tardando más de lo esperado. Verifica tu conexión.';
    }

    // Si es HttpErrorResponse
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No se puede conectar al servidor. Verifica tu conexión.';
      }
      if (error.status >= 500) {
        return 'Error del servidor. Intenta nuevamente.';
      }

      const errorBody: ApiErrorResponse = error.error;
      return errorBody?.message || 'No se pudo registrar la operación. Inténtalo de nuevo.';
    }

    return 'Error inesperado. Inténtalo de nuevo.';
  }

  // ========== MÉTODOS DE UTILIDAD OPTIMIZADOS ==========
  private mostrarMensajeExito(mensaje: string): void {
    this.successMessageTextSignal.set(mensaje);
    this.showSuccessMessageSignal.set(true);

    setTimeout(() => {
      this.showSuccessMessageSignal.set(false);
      this.regresarAlReloj();
    }, 2500);
  }

  private resetearCamara(): void {
    this.fotoCapturadaSignal.set(null);
    this.webcamErrorSignal.set(null);
    this.errorApiSignal.set(null);
  }

  private resetearEstado(): void {
    // Batch updates
    this.empleadoSignal.set(null);
    this.errorApiSignal.set(null);
    this.valorIngresadoSignal.set('');
    this.accionActualSignal.set(null);
    this.pausaActualSignal.set(null);
    this.resetearCamara();
  }

  private limpiarTimers(): void {
    if (this.capturaAutomaticaTimerId) {
      clearTimeout(this.capturaAutomaticaTimerId);
      this.capturaAutomaticaTimerId = undefined;
    }
    this.limpiarCountdownTimer();
  }

  private limpiarCountdownTimer(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = undefined;
    }
  }

  private limpiarTodosLosTimers(): void {
    this.limpiarTimers();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private enfocarInputSiEsNecesario(): void {
    if (this.vistaActualSignal() === 'reloj') {
      // Usar requestAnimationFrame para mejor rendimiento
      requestAnimationFrame(() => {
        this.codeInput?.nativeElement.focus();
      });
    }
  }

  // ========== MÉTODOS PÚBLICOS PARA TEMPLATE ==========
  handleInitError(error: WebcamInitError): void {
    this.webcamErrorSignal.set(error.message);
    console.error(error);
    this.limpiarTimers();
  }

  reintentarCaptura(): void {
    const accion = this.accionActualSignal();
    const pausa = this.pausaActualSignal();
    if (accion) {
      this.iniciarCapturaFoto(accion, pausa || undefined);
    }
  }

  regresarAVistaEmpleado(): void {
    this.vistaActualSignal.set('empleado');
    this.resetearCamara();
    this.accionActualSignal.set(null);
    this.pausaActualSignal.set(null);
    this.limpiarTimers();
  }

  regresarAlReloj(): void {
    this.vistaActualSignal.set('reloj');
    this.resetearEstado();
    this.limpiarTimers();
    this.enfocarInputSiEsNecesario();
  }

  // ========== MÉTODOS DE CONFIGURACIÓN CON PERSISTENCIA ==========
  private cargarConfiguracionDesdeStorage(): ConfiguracionSistema {
    try {
      const configGuardada = localStorage.getItem('checador-config');
      if (configGuardada) {
        return JSON.parse(configGuardada);
      }
    } catch (error) {
      console.warn('Error al cargar configuración desde localStorage:', error);
    }

    // Configuración por defecto
    return { modoSinCamara: false };
  }

  private guardarConfiguracionEnStorage(config: ConfiguracionSistema): void {
    try {
      localStorage.setItem('checador-config', JSON.stringify(config));
    } catch (error) {
      console.warn('Error al guardar configuración en localStorage:', error);
    }
  }

  toggleConfiguracion(): void {
    this.mostrarConfigSignal.set(!this.mostrarConfigSignal());
    this.codigoConfigSignal.set('');
  }

  agregarDigitoConfig(digito: number): void {
    const valorActual = this.codigoConfigSignal();
    if (valorActual.length < 4) {
      this.codigoConfigSignal.set(valorActual + digito.toString());
    }
  }

  borrarConfig(): void {
    const valorActual = this.codigoConfigSignal();
    if (valorActual.length > 0) {
      this.codigoConfigSignal.set(valorActual.slice(0, -1));
    }
  }

  aplicarConfiguracion(): void {
    const codigo = this.codigoConfigSignal();
    if (codigo === App.CODIGO_ADMIN) {
      const configActual = this.configuracionSignal();
      const nuevaConfig = {
        ...configActual,
        modoSinCamara: !configActual.modoSinCamara
      };

      this.configuracionSignal.set(nuevaConfig);
      this.guardarConfiguracionEnStorage(nuevaConfig); // Guardar en localStorage

      this.mostrarConfigSignal.set(false);
      this.codigoConfigSignal.set('');

      const mensaje = nuevaConfig.modoSinCamara
        ? 'Modo sin cámara activado'
        : 'Modo con cámara activado';
      this.mostrarMensajeExito(mensaje);
    } else {
      this.errorApiSignal.set('Código incorrecto');
      setTimeout(() => this.errorApiSignal.set(null), 2000);
    }
  }

  // ========== PROCESAMIENTO SIN CÁMARA ==========
  private procesarSinCamara(): void {
    const empleado = this.empleadoSignal();
    const accion = this.accionActualSignal();

    if (!empleado || !accion) {
      this.errorApiSignal.set("Error: Faltan datos para procesar la solicitud.");
      return;
    }

    this.isUploadingSignal.set(true);
    this.errorApiSignal.set(null);

    const { apiCall, successMessage } = this.obtenerConfiguracionAccionSinCamara();
    if (!apiCall) return;

    apiCall.pipe(
      timeout(App.TIMEOUT_MS),
      retry(App.RETRY_COUNT),
      takeUntil(this.destroy$),
      finalize(() => this.isUploadingSignal.set(false)),
      catchError((error: HttpErrorResponse) => {
        console.error('Error en procesamiento:', error);
        this.errorApiSignal.set(this.obtenerMensajeErrorProcesamiento(error));
        return of(null);
      })
    ).subscribe(response => {
      if (response?.success) {
        this.mostrarMensajeExito(successMessage);
      }
    });
  }

  // Configuración de acciones sin cámara
  private obtenerConfiguracionAccionSinCamara(): { apiCall: Observable<any> | null, successMessage: string } {
    const empleado = this.empleadoSignal()!;
    const accion = this.accionActualSignal()!;
    const pausa = this.pausaActualSignal();
    const fotoPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1 pixel transparente

    switch (accion) {
      case 'iniciarJornada':
        return {
          apiCall: this.checadorService.iniciarJornada(empleado.id, fotoPlaceholder),
          successMessage: '¡Jornada iniciada con éxito!'
        };
      case 'finalizarJornada':
        return {
          apiCall: this.checadorService.finalizarJornada(empleado.id, fotoPlaceholder),
          successMessage: '¡Jornada finalizada con éxito!'
        };
      case 'iniciarPausa':
        if (!pausa) return { apiCall: null, successMessage: '' };
        return {
          apiCall: this.checadorService.iniciarPausa(empleado.id, pausa, fotoPlaceholder),
          successMessage: `¡Pausa de ${pausa} iniciada!`
        };
      case 'finalizarPausa':
        if (!pausa) return { apiCall: null, successMessage: '' };
        return {
          apiCall: this.checadorService.finalizarPausa(empleado.id, pausa, fotoPlaceholder),
          successMessage: `¡Pausa de ${pausa} finalizada!`
        };
      default:
        this.errorApiSignal.set("Acción no reconocida.");
        return { apiCall: null, successMessage: '' };
    }
  }
}
