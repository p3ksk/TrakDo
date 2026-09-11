namespace TrakDo.API.Helpers;

public static class SecretHelper
{
    /// <summary>
    /// Creates the password hash and salt.
    /// </summary>
    /// <param name="password"></param>
    /// <param name="passwordHash"></param>
    /// <param name="passwordSalt"></param>
    public static void CreatePasswordHash(string password, out byte[] passwordHash, out byte[] passwordSalt)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA512();
        passwordSalt = hmac.Key;
        passwordHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
    }

    /// <summary>
    /// Verifies the password hash.
    /// </summary>
    /// <param name="password"></param>
    /// <param name="passwordHash"></param>
    /// <param name="passwordSalt"></param>
    /// <returns></returns>
    public static bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA512(passwordSalt);
        byte[] computedHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
        for (int i = 0; i < computedHash.Length; i++)
        {
            if (computedHash[i] != passwordHash[i])
            {
                return false;
            }
        }
        return true;
    }
}