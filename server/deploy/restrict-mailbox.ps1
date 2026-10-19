# Beschränkt die App auf GENAU EIN Postfach (Exchange Online "RBAC for Applications").
# Ausführen in PowerShell als Exchange-Administrator:
#   Install-Module ExchangeOnlineManagement   (einmalig)
#   Connect-ExchangeOnline
#   .\restrict-mailbox.ps1 -AppId <Client-ID> -ObjectId <Objekt-ID der Unternehmensanwendung> -Mailbox rechnungen@ihre-domain.de
param(
  [Parameter(Mandatory)] [string] $AppId,
  [Parameter(Mandatory)] [string] $ObjectId,
  [Parameter(Mandatory)] [string] $Mailbox
)
$ErrorActionPreference = 'Stop'
New-ServicePrincipal -AppId $AppId -ObjectId $ObjectId -DisplayName 'InMedi Rechnungseingang'
New-ManagementScope -Name 'InMedi Rechnungspostfach' -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$Mailbox'"
New-ManagementRoleAssignment -App $AppId -Role 'Application Mail.ReadWrite' -CustomResourceScope 'InMedi Rechnungspostfach'
Write-Host 'Prüfen (sollte InScope = True zeigen):'
Test-ServicePrincipalAuthorization -Identity $AppId -Resource $Mailbox | Format-Table
