import { beforeEach, describe, expect, it } from 'vitest'
import { RangesList } from '../RangesList'

describe('RangesList', () => {
  let rs: RangesList<number>
  beforeEach(() => {
    rs = new RangesList()

  })
  describe("sequential order", () => {
    beforeEach(() => {
      rs.insert(0, 0.5, 1)
      rs.insert(0.5, 1, 2)
      rs.insert(1, 2.5, 3)
      rs.insert(2.5, 3, 4)
      rs.insert(4, 10, 5)
      rs.insert(10, 11, 6)
    })
    it.each([
      [-1, null],
      [0, 1],
      [0.25, 1],
      [0.5, 2],
      [1, 3],
      [2.5, 4],
      [4, 5],
      [10, 6],
      [11, null],
      [-100, null],
      [1020, null],
    ])('%s -> %s', (pos, expVal) => {
      expect(rs.find(pos)).toBe(expVal)
    })
  })
  describe("arbitrary order", () => {
    beforeEach(() => {
      rs.insert(10, 11, 6)
      rs.insert(2.5, 3, 4)
      rs.insert(1, 2.5, 3)
      rs.insert(0.5, 1, 2)
      rs.insert(4, 10, 5)
      rs.insert(0, 0.5, 1)
    })
    it.each([
      [-1, null],
      [0, 1],
      [0.25, 1],
      [0.5, 2],
      [1, 3],
      [2.5, 4],
      [4, 5],
      [10, 6],
      [11, null],
      [-100, null],
      [1020, null],
    ])('%s -> %s', (pos, expVal) => {
      expect(rs.find(pos)).toBe(expVal)
    })
  })
})
