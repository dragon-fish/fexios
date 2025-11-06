type Func<Args extends unknown[], Return> = (...args: Args) => Return

interface CallableInstanceConstructor {
  // prettier-ignore
  new <Args extends unknown[], Return>(property: string | symbol):
    Func<Args, Return> & CallableInstance<Args, Return>
  readonly prototype: CallableInstance<any, any>
}

interface CallableInstance<Args extends unknown[], Return> extends Function {
  (...args: Args): Return
}

const CallableInstanceImpl = function (this: any, property: string | symbol) {
  const proto = this.constructor.prototype
  const func = Reflect.get(proto, property, proto) as Function
  function apply(this: unknown, ...args: unknown[]) {
    return Reflect.apply(func, apply, args)
  }
  Reflect.setPrototypeOf(apply, proto)
  for (const key of Reflect.ownKeys(func)) {
    const desc = Reflect.getOwnPropertyDescriptor(func, key)
    if (desc) Reflect.defineProperty(apply, key, desc)
  }
  return apply
} as any
CallableInstanceImpl.prototype = Object.create(Function.prototype)

export const CallableInstance =
  CallableInstanceImpl as unknown as CallableInstanceConstructor
