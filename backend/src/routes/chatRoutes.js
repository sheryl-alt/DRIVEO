import { Router } from 'express'
import { sendChat } from '../controllers/chatController.js'

const router = Router()

router.post('/chat', sendChat)

export default router
