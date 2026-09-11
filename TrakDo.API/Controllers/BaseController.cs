using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TrakDo.API.Controllers;

[Authorize]
[ApiController]
public abstract class BaseController : ControllerBase
{
    protected long CurrentUserId => long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new InvalidOperationException("User ID claim is missing."));
}

[Route("api/v1/[controller]")]
public abstract class V1BaseController : BaseController
{
}