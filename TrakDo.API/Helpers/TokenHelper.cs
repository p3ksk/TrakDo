using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using TrakDo.API.Models;

namespace TrakDo.API.Helpers;

public class TokenHelper
{
    private readonly SymmetricSecurityKey key;
    private readonly double tokenDurationMinutes;
    
    public TokenHelper(IConfiguration configuration)
    {
        key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration.GetSection("SecretKey").Value!));
        tokenDurationMinutes = double.Parse(configuration.GetSection("TokenDurationMinutes").Value ?? "10");
    }
    
    public string CreateToken(User user) 
    {
        SigningCredentials credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            SigningCredentials = credentials,
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username)
            }),
            Expires = DateTime.UtcNow.AddMinutes(tokenDurationMinutes)
        };

        JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
        SecurityToken token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
