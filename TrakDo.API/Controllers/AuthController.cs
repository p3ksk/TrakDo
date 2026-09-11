using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos;
using TrakDo.API.Dtos.User;
using TrakDo.API.Helpers;
using TrakDo.API.Models;

namespace TrakDo.API.Controllers;

public class AuthController : V1BaseController
{
    private readonly ILogger<AuthController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;
    private readonly TokenHelper _tokenHelper;

    public AuthController(ILogger<AuthController> logger, IDbContextFactory<TrakDoDbContext> contextFactory, TokenHelper tokenHelper)
    {
        _logger = logger;
        _contextFactory = contextFactory;
        _tokenHelper = tokenHelper;
    }
    
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("register")]
    public async Task<IActionResult> RegisterAsync(AuthUserRequest user)
    {
        await using var context = await  _contextFactory.CreateDbContextAsync();
        if (await context.Users.AnyAsync(u => u.Username == user.Username))
        {
            _logger.LogWarning("Username {username} is already used.", user.Username);
            return BadRequest("Username already used.");
        }
        
        SecretHelper.CreatePasswordHash(user.Password, out byte[] passwordHash, out byte[] passwordSalt);
        var createdUser = (await context.Users.AddAsync(new User
        {
            Username = user.Username,
            Created = DateTime.UtcNow,
            PasswordHash = passwordHash,
            PasswordSalt = passwordSalt
        })).Entity;
        await context.SaveChangesAsync();

        return Created(string.Empty, new LoginResponse()
        {
            Username = createdUser.Username,
            Token = _tokenHelper.CreateToken(createdUser),
        });
    }

    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("login")]
    public async Task<IActionResult> LoginAsync(AuthUserRequest user)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var dbUser = await context.Users.SingleOrDefaultAsync(u => u.Username == user.Username);
        if (dbUser == null)
        {
            _logger.LogWarning("Failed login attempt for username {username}", user.Username);
            return Unauthorized("Wrong username or password.");
        }

        if (!SecretHelper.VerifyPasswordHash(user.Password, dbUser.PasswordHash, dbUser.PasswordSalt))
        {
            _logger.LogWarning("Failed login attempt for username {username}", user.Username);
            return Unauthorized("Wrong username or password.");
        }
        
        return Ok(new LoginResponse()
        {
            Username = dbUser.Username,
            Token = _tokenHelper.CreateToken(dbUser),
        });
    }
}
