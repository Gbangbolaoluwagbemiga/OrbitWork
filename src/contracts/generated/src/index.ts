export class Client {
  constructor(public options: any) {}
  [key: string]: any;
  async get_escrow(args: any) { return { result: null }; }
  async get_user_escrows(args: any) { return { result: [] }; }
  async get_reputation(args: any) { return { result: 0 }; }
}
