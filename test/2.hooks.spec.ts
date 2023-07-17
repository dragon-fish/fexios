import { Fexios } from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { Todo, Comment } from './MockData'

const now = Date.now()

describe('Fexios Hooks', () => {
  it('[HOOKS] register hooks', async () => {
    const fexios = new Fexios({
      baseURL: 'https://jsonplaceholder.typicode.com',
    })
    fexios.on('beforeInit', (ctx) => {
      expect(ctx.url).to.equal('/todos/1')
      ctx.url = '/todos/2'
      return ctx
    })
    fexios.on('beforeRequest', (ctx) => {
      expect(ctx.url).to.equal('https://jsonplaceholder.typicode.com/todos/2')
      ctx.url = ctx.url.replace('2', '3')
      return ctx
    })
    fexios.on('afterResponse', (ctx) => {
      expect(ctx.data).to.be.an('object')
      expect(ctx.data.id).to.equal(3)
      ctx.data.id = now
      return ctx
    })
    const { data } = await fexios.get<Todo>('/todos/1')
    expect(data.id).to.equal(now)
  })

  it('[HOOKS] interceptors sugar', async () => {
    const fexios = new Fexios({
      baseURL: 'https://jsonplaceholder.typicode.com',
    })
    fexios.interceptors.request.use((ctx) => {
      expect(ctx.url).to.equal('https://jsonplaceholder.typicode.com/todos/1')
      ctx.url = ctx.url.replace('1', '2')
      return ctx
    })
    fexios.interceptors.response.use((ctx) => {
      expect(ctx.data).to.be.an('object')
      expect(ctx.data.id).to.equal(2)
      ctx.data.id = now
      return ctx
    })
    const { data } = await fexios.get('/todos/1')
    expect(data.id).to.equal(now)
  })
})
