import { Fexios } from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { Todo, Comment } from './MockData'

describe('Fexios Hooks', () => {
  it('[HOOKS] register hooks', async () => {
    const fexios = new Fexios({
      baseURL: 'https://jsonplaceholder.typicode.com',
    })
    fexios.on('beforeInit', (ctx) => {
      expect(ctx).to.be.an('object')
      expect(ctx.url).to.equal('/todos/1')
      return ctx
    })
    fexios.on('beforeRequest', (ctx) => {
      expect(ctx).to.be.an('object')
      expect(ctx.url).to.equal('https://jsonplaceholder.typicode.com/todos/1')
      return ctx
    })
    fexios.on('afterResponse', (ctx) => {
      expect(ctx).to.be.an('object')
      expect(ctx.response).to.not.be.undefined
      return ctx
    })
    const { data } = await fexios.get('/todos/1')
    expect(data).to.be.an('object')
  })

  it('[HOOKS] interceptors sugar', async () => {
    const fexios = new Fexios({
      baseURL: 'https://jsonplaceholder.typicode.com',
    })
    fexios.interceptors.request.use((ctx) => {
      expect(ctx).to.be.an('object')
      expect(ctx.url).to.equal('https://jsonplaceholder.typicode.com/todos/1')
      return ctx
    })
    fexios.interceptors.response.use((ctx) => {
      expect(ctx).to.be.an('object')
      expect(ctx.response).to.not.be.undefined
      return ctx
    })
    const { data } = await fexios.get('/todos/1')
    expect(data).to.be.an('object')
  })
})
