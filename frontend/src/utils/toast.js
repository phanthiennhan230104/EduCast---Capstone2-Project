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

export const showToast = (message, type = 'info', options = {}) => {
  if (notify[type]) {
    notify[type](message, options)
  } else {
    notify.info(message, options)
  }
}

export default notify