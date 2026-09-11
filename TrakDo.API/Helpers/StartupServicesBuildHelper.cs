using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MySqlConnector;
using TrakDo.API.Data;

namespace TrakDo.API.Helpers;

public static class StartupServicesBuildHelper
{
    public static void SetupServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<TokenHelper>();
    }

    public static void SetupDatabase(this WebApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString("MySqlServer");
        builder.Services.AddDbContextFactory<TrakDoDbContext>(opts =>
            opts.UseMySql(
                connectionString,
                ServerVersion.AutoDetect(connectionString),
                mySqlOptions => mySqlOptions.EnableRetryOnFailure()));
    }

    public static void ApplyMigrationsWithRetry(this WebApplication app, int maxAttempts = 10)
    {
        ArgumentNullException.ThrowIfNull(app);

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            using var scope = app.Services.CreateScope();
            var services = scope.ServiceProvider;
            var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("StartupMigration");

            try
            {
                services.GetRequiredService<TrakDoDbContext>().Database.Migrate();
                return;
            }
            catch (MySqlException ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(ex, "MySQL not ready for migrations (attempt {Attempt}/{MaxAttempts}). Retrying...", attempt, maxAttempts);
                Thread.Sleep(TimeSpan.FromSeconds(5));
            }
            catch (InvalidOperationException ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(ex, "Database migration failed with transient startup error (attempt {Attempt}/{MaxAttempts}). Retrying...", attempt, maxAttempts);
                Thread.Sleep(TimeSpan.FromSeconds(5));
            }
        }

        using var finalScope = app.Services.CreateScope();
        finalScope.ServiceProvider.GetRequiredService<TrakDoDbContext>().Database.Migrate();
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
        });
        
    }
}
