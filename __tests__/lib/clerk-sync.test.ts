import { 
  syncClerkUserToMongoDB, 
  updateClerkUserInMongoDB, 
  deleteClerkUserFromMongoDB,
  getOrCreateUserByClerkId,
  updateUserLoginTracking,
  type ClerkUserData 
} from '@/lib/clerk-sync';
import User from '@/lib/models/user.model';
import { connectToDB } from '@/lib/mongoose';
import { clerkClient } from '@clerk/nextjs/server';

// Mock dependencies
jest.mock('@/lib/mongoose');
jest.mock('@/lib/models/user.model');
jest.mock('@clerk/nextjs/server');
jest.mock('@sentry/nextjs');

const mockConnectToDB = connectToDB as jest.MockedFunction<typeof connectToDB>;
const mockUser = User as jest.Mocked<typeof User>;
const mockClerkClient = clerkClient as jest.Mocked<typeof clerkClient>;

// Test data
const mockClerkUserData: ClerkUserData = {
  id: 'clerk_test_user_123',
  email_addresses: [
    {
      email_address: 'test@example.com',
      verification: {
        status: 'verified'
      }
    }
  ],
  first_name: 'John',
  last_name: 'Doe',
  image_url: 'https://example.com/avatar.jpg',
  created_at: Date.now(),
  updated_at: Date.now(),
};

const mockMongoUser = {
  _id: 'mongo_user_123',
  clerkId: 'clerk_test_user_123',
  email: 'test@example.com',
  emailVerified: true,
  firstName: 'John',
  lastName: 'Doe',
  avatar: 'https://example.com/avatar.jpg',
  role: 'user',
  status: 'active',
  subscription: {
    plan: 'free',
    status: 'active',
    cancelAtPeriodEnd: false,
  },
  usage: {
    productsTracked: 0,
    maxProducts: 5,
    apiCalls: 0,
    maxApiCalls: 0,
    emailsSent: 0,
    maxEmails: 10,
    resetDate: new Date(),
  },
  lastLoginAt: new Date(),
  loginCount: 1,
  deletedAt: undefined as Date | undefined,
  save: jest.fn().mockResolvedValue(true),
};

describe('Clerk-MongoDB Sync Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDB.mockResolvedValue({} as any);
  });

  describe('syncClerkUserToMongoDB', () => {
    it('should create a new user when user does not exist', async () => {
      // Mock User.findOne to return null (user doesn't exist)
      mockUser.findOne = jest.fn().mockResolvedValue(null);
      
      // Mock User constructor and save
      const mockUserInstance = {
        ...mockMongoUser,
        save: jest.fn().mockResolvedValue(mockMongoUser)
      };
      (User as any).mockImplementation(() => mockUserInstance);

      const result = await syncClerkUserToMongoDB(mockClerkUserData);

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockUser.findOne).toHaveBeenCalledWith({ clerkId: mockClerkUserData.id });
      expect(User).toHaveBeenCalledWith(expect.objectContaining({
        clerkId: mockClerkUserData.id,
        email: mockClerkUserData.email_addresses[0].email_address,
        emailVerified: true,
        firstName: mockClerkUserData.first_name,
        lastName: mockClerkUserData.last_name,
        avatar: mockClerkUserData.image_url,
      }));
      expect(mockUserInstance.save).toHaveBeenCalled();
    });

    it('should update existing user when user exists', async () => {
      // Mock User.findOne to return existing user
      const existingUser = {
        ...mockMongoUser,
        loginCount: 5,
      };
      mockUser.findOne = jest.fn().mockResolvedValue(existingUser);

      const result = await syncClerkUserToMongoDB(mockClerkUserData);

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockUser.findOne).toHaveBeenCalledWith({ clerkId: mockClerkUserData.id });
      expect(existingUser.email).toBe(mockClerkUserData.email_addresses[0].email_address);
      expect(existingUser.emailVerified).toBe(true);
      expect(existingUser.loginCount).toBe(6); // Should increment
      expect(existingUser.save).toHaveBeenCalled();
    });

    it('should throw error when no email address found', async () => {
      const invalidClerkUserData = {
        ...mockClerkUserData,
        email_addresses: []
      };

      await expect(syncClerkUserToMongoDB(invalidClerkUserData))
        .rejects
        .toThrow('No email address found for Clerk user');
    });

    it('should handle database connection errors', async () => {
      mockConnectToDB.mockRejectedValue(new Error('Database connection failed'));

      await expect(syncClerkUserToMongoDB(mockClerkUserData))
        .rejects
        .toThrow('Database connection failed');
    });
  });

  describe('updateClerkUserInMongoDB', () => {
    it('should update existing user', async () => {
      const existingUser = { ...mockMongoUser };
      mockUser.findOne = jest.fn().mockResolvedValue(existingUser);

      const result = await updateClerkUserInMongoDB(mockClerkUserData);

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockUser.findOne).toHaveBeenCalledWith({ clerkId: mockClerkUserData.id });
      expect(existingUser.email).toBe(mockClerkUserData.email_addresses[0].email_address);
      expect(existingUser.save).toHaveBeenCalled();
    });

    it('should create user if user does not exist', async () => {
      mockUser.findOne = jest.fn().mockResolvedValue(null);
      
      const mockUserInstance = {
        ...mockMongoUser,
        save: jest.fn().mockResolvedValue(mockMongoUser)
      };
      (User as any).mockImplementation(() => mockUserInstance);

      const result = await updateClerkUserInMongoDB(mockClerkUserData);

      expect(User).toHaveBeenCalled();
      expect(mockUserInstance.save).toHaveBeenCalled();
    });
  });

  describe('deleteClerkUserFromMongoDB', () => {
    it('should soft delete existing user', async () => {
      const existingUser = { ...mockMongoUser };
      mockUser.findOne = jest.fn().mockResolvedValue(existingUser);

      await deleteClerkUserFromMongoDB('clerk_test_user_123');

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockUser.findOne).toHaveBeenCalledWith({ clerkId: 'clerk_test_user_123' });
      expect(existingUser.status).toBe('deleted');
      expect(existingUser.deletedAt).toBeInstanceOf(Date);
      expect(existingUser.save).toHaveBeenCalled();
    });

    it('should handle case when user does not exist', async () => {
      mockUser.findOne = jest.fn().mockResolvedValue(null);

      // Should not throw error
      await expect(deleteClerkUserFromMongoDB('non_existent_user'))
        .resolves
        .toBeUndefined();
    });
  });

  describe('getOrCreateUserByClerkId', () => {
    it('should return existing user when found', async () => {
      const existingUser = { ...mockMongoUser };
      mockUser.findOne = jest.fn().mockResolvedValue(existingUser);

      const result = await getOrCreateUserByClerkId('clerk_test_user_123');

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockUser.findOne).toHaveBeenCalledWith({
        clerkId: 'clerk_test_user_123',
        status: { $ne: 'deleted' },
        deletedAt: { $exists: false }
      });
      expect(result).toBe(existingUser);
    });

    it('should create user when not found', async () => {
      mockUser.findOne = jest.fn().mockResolvedValue(null);
      mockClerkClient.users.getUser = jest.fn().mockResolvedValue({
        id: mockClerkUserData.id,
        emailAddresses: [{
          emailAddress: mockClerkUserData.email_addresses[0].email_address,
          verification: { status: 'verified' }
        }],
        firstName: mockClerkUserData.first_name,
        lastName: mockClerkUserData.last_name,
        imageUrl: mockClerkUserData.image_url,
        createdAt: mockClerkUserData.created_at,
        updatedAt: mockClerkUserData.updated_at,
      });

      const mockUserInstance = {
        ...mockMongoUser,
        save: jest.fn().mockResolvedValue(mockMongoUser)
      };
      (User as any).mockImplementation(() => mockUserInstance);

      const result = await getOrCreateUserByClerkId('clerk_test_user_123');

      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith('clerk_test_user_123');
      expect(User).toHaveBeenCalled();
      expect(mockUserInstance.save).toHaveBeenCalled();
    });

    it('should handle Clerk API errors', async () => {
      mockUser.findOne = jest.fn().mockResolvedValue(null);
      mockClerkClient.users.getUser = jest.fn().mockRejectedValue(new Error('Clerk API error'));

      await expect(getOrCreateUserByClerkId('clerk_test_user_123'))
        .rejects
        .toThrow('Clerk API error');
    });
  });

  describe('updateUserLoginTracking', () => {
    it('should update login tracking for existing user', async () => {
      mockUser.findOneAndUpdate = jest.fn().mockResolvedValue(mockMongoUser);

      await updateUserLoginTracking('clerk_test_user_123');

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockUser.findOneAndUpdate).toHaveBeenCalledWith(
        { clerkId: 'clerk_test_user_123' },
        { 
          lastLoginAt: expect.any(Date),
          $inc: { loginCount: 1 }
        }
      );
    });

    it('should handle database errors gracefully', async () => {
      mockUser.findOneAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw error (graceful handling)
      await expect(updateUserLoginTracking('clerk_test_user_123'))
        .resolves
        .toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid email verification status', async () => {
      const invalidClerkUserData = {
        ...mockClerkUserData,
        email_addresses: [
          {
            email_address: 'test@example.com',
            verification: {
              status: 'pending'
            }
          }
        ]
      };

      mockUser.findOne = jest.fn().mockResolvedValue(null);
      const mockUserInstance = {
        ...mockMongoUser,
        save: jest.fn().mockResolvedValue(mockMongoUser)
      };
      (User as any).mockImplementation(() => mockUserInstance);

      const result = await syncClerkUserToMongoDB(invalidClerkUserData);

      expect(User).toHaveBeenCalledWith(expect.objectContaining({
        emailVerified: false, // Should be false for non-verified status
      }));
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalClerkUserData = {
        id: 'clerk_test_user_123',
        email_addresses: [
          {
            email_address: 'test@example.com',
            verification: {
              status: 'verified'
            }
          }
        ],
        first_name: null,
        last_name: null,
        image_url: undefined,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockUser.findOne = jest.fn().mockResolvedValue(null);
      const mockUserInstance = {
        ...mockMongoUser,
        save: jest.fn().mockResolvedValue(mockMongoUser)
      };
      (User as any).mockImplementation(() => mockUserInstance);

      const result = await syncClerkUserToMongoDB(minimalClerkUserData);

      expect(User).toHaveBeenCalledWith(expect.objectContaining({
        firstName: '',
        lastName: '',
        avatar: undefined,
      }));
    });
  });
});