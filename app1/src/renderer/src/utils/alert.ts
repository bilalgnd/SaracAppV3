import Swal from 'sweetalert2'

// Inject a global style to ensure sweetalert is ALWAYS on top of modals (which usually have z-index 1000)
const style = document.createElement('style')
style.innerHTML = `
  .swal2-container {
    z-index: 99999 !important;
  }
`
document.head.appendChild(style)

export const customAlert = (text: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  return Swal.fire({
    title: text,
    icon: icon,
    background: '#1a1a1a',
    color: '#fff',
    confirmButtonColor: '#4ade80',
    timer: 3000,
    timerProgressBar: true,
    showConfirmButton: false,
    toast: true,
    position: 'top-end'
  })
}

export const customConfirm = async (text: string) => {
  const result = await Swal.fire({
    title: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#4ade80',
    confirmButtonText: 'Evet',
    cancelButtonText: 'İptal',
    background: '#1a1a1a',
    color: '#fff'
  })
  return result.isConfirmed
}
