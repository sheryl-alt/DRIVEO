import { Router } from 'express'
import {
  listCars, getCar, createCar, updateCar, deleteCar
} from '../controllers/carController.js'

const router = Router()

router.get('/', listCars)
router.get('/:id', getCar)
router.post('/', createCar)
router.put('/:id', updateCar)
router.delete('/:id', deleteCar)

export default router
