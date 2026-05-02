import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

const MySwal = withReactContent(Swal)

// Configure default styles
MySwal.mixin({
  customClass: {
    popup: 'rounded-2xl',
    confirmButton: 'rounded-xl',
    cancelButton: 'rounded-xl',
  },
  buttonsStyling: false,
})

export { MySwal }

// ────────────────────────────────────────────────────────────────────
// API call helper with SweetAlert2 loading/success/error
// ────────────────────────────────────────────────────────────────────

interface ApiCallOptions<T> {
  title: string;
  loadingText: string;
  apiCall: () => Promise<T>;
  successText?: string;
  successTitle?: string;
  errorTitle?: string;
}

export async function apiCallWithAlert<T>({
  title,
  loadingText,
  apiCall,
  successText,
  successTitle = 'Success',
  errorTitle = 'Error',
}: ApiCallOptions<T>): Promise<T | null> {
  const { default: Swal } = await import('sweetalert2')
  const withReactContent = (await import('sweetalert2-react-content')).default
  const swal = withReactContent(Swal)

  try {
    void swal.fire({
      title,
      text: loadingText,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        swal.showLoading()
      },
    })

    const result = await apiCall()
    swal.close()
    await swal.fire({
      icon: 'success',
      title: successTitle,
      text: successText || 'Operation completed successfully',
      confirmButtonColor: '#2d5a27',
    })
    return result
  } catch (error: any) {
    swal.close()
    const message = error?.response?.data?.message || error?.message || 'An unexpected error occurred. Please try again.'
    await swal.fire({
      icon: 'error',
      title: errorTitle,
      text: message,
      confirmButtonColor: '#2d5a27',
    })
    return null
  }
}
