import { Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthRequest } from '../types/express.d';
import { sendError } from '../utils/response';
import { ObjectId, Collection, Document } from 'mongodb';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJWKS = () => {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
  }
  return jwks;
};

let userCollectionRef: Collection<Document> | null = null;

export const setUserCollection = (collection: Collection<Document>) => {
  userCollectionRef = collection;
};

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return sendError(res, 'Unauthorized', 401);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return sendError(res, 'Unauthorized', 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS());
    req.user = payload as unknown as AuthRequest['user'];

    if (userCollectionRef && req.user?.sub) {
      const user = await userCollectionRef.findOne({ _id: new ObjectId(req.user.sub) });
      if (user?.isBlocked) {
        return sendError(res, 'Account blocked. Contact admin.', 403);
      }
    }

    next();
  } catch {
    return sendError(res, 'Unauthorized', 401);
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      return sendError(res, 'Forbidden', 403);
    }
    next();
  };
};
