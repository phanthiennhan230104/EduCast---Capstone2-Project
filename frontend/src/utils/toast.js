import { toast } from 'react-toastify'

const defaultOptions = {
  position: 'top-right',
  autoClose: 2200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
}

const notify = {
  success: (message, options = {}) =>
    toast.success(message, { ...defaultOptions, ...options }),

  error: (message, options = {}) =>
    toast.error(message, { ...defaultOptions, ...options }),

  info: (message, options = {}) =>
    toast.info(message, { ...defaultOptions, ...options }),

  warning: (message, options = {}) =>
    toast.warning(message, { ...defaultOptions, ...options }),
}

export default notify