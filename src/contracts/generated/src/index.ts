export class Client {
  constructor(public options: any) {}
  [key: string]: any;
  async get_escrow(_args: any) { return { result: null }; }
  async get_user_escrows(_args: any) { return { result: [] }; }
  async get_reputation(_args: any) { return { result: 0 }; }
}
