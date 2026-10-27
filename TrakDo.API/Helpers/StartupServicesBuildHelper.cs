using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TrakDo.API.Data;

namespace TrakDo.API.Helpers;

public static class StartupServicesBuildHelper
{
    public static void SetupServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<TokenHelper>();
        builder.Services.AddSingleton<IAuthorizationHandler, AdminAuthorizationHandler>();
    }

    /// <summary>
    /// Brings the schema up to date at startup. If the database is not reachable this throws and
    /// the process exits, which the container restart policy retries — no retry loop needed here.
    /// </summary>
    public static void ApplyMigrations(this WebApplication app)
    {
        using var context = app.Services.GetRequiredService<IDbContextFactory<TrakDoDbContext>>().CreateDbContext();
        context.Database.Migrate();
    }

    public static void SetupDatabase(this WebApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString("MySqlServer");

        // AutoDetect opens a connection of its own, and this lambda runs every time a context is
        // created — which, because the controllers use IDbContextFactory, is once per request.
        // Resolve it once instead. PublicationOnly is what keeps a failure from being cached, so a
        // database that is not up yet gets probed again rather than poisoning the whole process.
        var serverVersion = new Lazy<ServerVersion>(
            () => ServerVersion.AutoDetect(connectionString),
            LazyThreadSafetyMode.PublicationOnly);

        builder.Services.AddDbContextFactory<TrakDoDbContext>(opts =>
            opts.UseMySql(
                connectionString,
                serverVersion.Value,
                mySqlOptions => mySqlOptions.EnableRetryOnFailure()));
    }


    public static void SetupAuthentication(this WebApplicationBuilder builder)
    {
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey =
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration.GetSection("SecretKey")?.Value 
                                                                    ?? throw new Exception("SecretKey is not set"))),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true
            };

            // Tokens outlive accounts: reject a still-valid token whose user has been deleted by an admin.
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = async context =>
                {
                    if (!long.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
                    {
                        context.Fail("User ID claim is missing.");
                        return;
                    }

                    var contextFactory = context.HttpContext.RequestServices.GetRequiredService<IDbContextFactory<TrakDoDbContext>>();
                    await using var dbContext = await contextFactory.CreateDbContextAsync();
                    if (!await dbContext.Users.AnyAsync(_ => _.Id == userId))
                    {
                        context.Fail("User no longer exists.");
                    }
                }
            };
        });

        builder.Services.AddAuthorization(options =>
            options.AddPolicy(AdminRequirement.PolicyName, policy => policy
                .RequireAuthenticatedUser()
                .AddRequirements(new AdminRequirement())));
    }
}
