import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import { redis } from '@/lib/upstash';
import { z } from 'zod';

// Fix build issues by forcing dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Admin-only endpoint for user management
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectToDB();

    // Get user from database to check admin role
    const adminUser = await User.findOne({ clerkId: userId });
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const plan = searchParams.get('plan') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Build query
    const query: any = { deletedAt: { $exists: false } };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (plan) {
      query['subscription.plan'] = plan;
    }

    if (status) {
      query.status = status;
    }

    // Get cached count if no filters
    const cacheKey = `admin:users:count:${JSON.stringify(query)}`;
    const cachedCount = await redis.get(cacheKey);
    
    let totalUsers: number;
    if (!cachedCount) {
      totalUsers = await User.countDocuments(query);
      await redis.setex(cacheKey, 300, totalUsers); // Cache for 5 minutes
    } else {
      totalUsers = parseInt(cachedCount as string);
    }

    // Get users with pagination
    const users = await User.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'firstName lastName email status subscription lastLoginAt loginCount usage createdAt role'
      )
      .lean();

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch users',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Update user (admin actions)
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectToDB();

    // Get user from database to check admin role
    const adminUser = await User.findOne({ clerkId: userId });
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate request body
    const updateSchema = z.object({
      targetUserId: z.string(),
      action: z.enum(['suspend', 'activate', 'change_plan', 'reset_usage', 'delete']),
      value: z.string().optional() // For plan changes
    });

    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { targetUserId, action, value } = validation.data;

    // Find target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Perform action
    let updateData: any = {};
    let message = '';

    switch (action) {
      case 'suspend':
        updateData.status = 'suspended';
        message = 'User suspended successfully';
        break;
        
      case 'activate':
        updateData.status = 'active';
        message = 'User activated successfully';
        break;
        
      case 'change_plan':
        if (!value || !['free', 'pro', 'enterprise'].includes(value)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid plan specified'
          }, { status: 400 });
        }
        updateData['subscription.plan'] = value;
        message = `User plan changed to ${value}`;
        break;
        
      case 'reset_usage':
        updateData['usage.productsTracked'] = 0;
        updateData['usage.apiCalls'] = 0;
        updateData['usage.emailsSent'] = 0;
        updateData['usage.resetDate'] = new Date();
        message = 'User usage reset successfully';
        break;
        
      case 'delete':
        updateData.deletedAt = new Date();
        updateData.status = 'deleted';
        message = 'User deleted successfully';
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

    // Update user
    await User.findByIdAndUpdate(targetUserId, updateData);

    // Invalidate cache
    await redis.del('admin:users:count:*');

    // Log admin action
    console.log(`Admin ${adminUser.email} performed ${action} on user ${targetUser.email}`);

    return NextResponse.json({
      success: true,
      message,
      data: {
        action,
        targetUser: {
          id: targetUser._id,
          email: targetUser.email,
          name: `${targetUser.firstName} ${targetUser.lastName}`
        }
      }
    });

  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update user',
        details: error.message 
      },
      { status: 500 }
    );
  }
}