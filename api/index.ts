import startServer from '../server';

export default async (req: any, res: any) => {
  const app = await startServer();
  return app(req, res);
};
