using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;

namespace TrakDo.API.Helpers;

public class AdminRequirement : IAuthorizationRequirement
{
    public const string PolicyName = "Admin";
}

/// <summary>
/// Reads the admin flag from the database on every request instead of trusting a token claim,
/// so promoting or demoting a user takes effect immediately.
/// </summary>
public class AdminAuthorizationHandler : AuthorizationHandler<AdminRequirement>
{
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public AdminAuthorizationHandler(IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, AdminRequirement requirement)
    {
        if (!long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return;
        }

        await using var dbContext = await _contextFactory.CreateDbContextAsync();
        if (await dbContext.Users.AnyAsync(_ => _.Id == userId && _.IsAdmin))
        {
            context.Succeed(requirement);
        }
    }
}
