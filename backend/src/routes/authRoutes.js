import { Router } from 'express'
import {
  loginUser,
  loginAdmin,
  registerUser,
  checkSession,
  logout
} from '../controllers/authController.js'

const router = Router()

router.post('/user/login', loginUser)
router.post('/admin/login', loginAdmin)
router.post('/register', registerUser)
router.get('/session', checkSession)
router.post('/logout', logout)

export default router
