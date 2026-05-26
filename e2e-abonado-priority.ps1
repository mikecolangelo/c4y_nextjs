$token = 'frontend_token_1775409392'
$finId = 'mhfjzcme77f3xd3r98ny2fg2'
$finNumId = 45
$baseStrapi = 'https://api.car4youpanama.com'
$baseLocal = 'http://localhost:3000'

function Strapi-List($filters) {
    $q = ($filters -join '&')
    return Invoke-RestMethod -Uri "$baseStrapi/api/billing-records?$q" -Headers @{Authorization="Bearer $token"}
}
function Strapi-Delete($docId) {
    try {
        Invoke-RestMethod -Uri "$baseStrapi/api/billing-records/$docId" -Headers @{Authorization="Bearer $token"} -Method DELETE | Out-Null
        return $true
    } catch { return $false }
}
function Strapi-Create($payload) {
    $body = @{ data = $payload } | ConvertTo-Json -Depth 3
    return Invoke-RestMethod -Uri "$baseStrapi/api/billing-records" -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} -Method POST -Body $body
}
function Local-PostBilling($payload) {
    $body = @{ data = $payload } | ConvertTo-Json -Depth 3
    return Invoke-RestMethod -Uri "$baseLocal/api/billing" -Headers @{"Content-Type"="application/json"} -Method POST -Body $body
}
function Get-Record($docId) {
    $r = Strapi-List "filters[documentId][`$eq]=$docId", "pagination[pageSize]=1"
    return $r.data | Select-Object -First 1
}

Write-Host "========================================"
Write-Host "E2E TEST: Abonado mas antiguo primero"
Write-Host "========================================"

# 1. Limpieza
$existing = Strapi-List "filters[financing][documentId][`$eq]=$finId", "pagination[pageSize]=100"
foreach ($r in $existing.data) { Strapi-Delete $r.documentId | Out-Null }
Write-Host "[SETUP] $($existing.data.Length) records eliminados"

# 2. Crear cuota #5 abonada (dueDate mas antiguo)
$ts = Get-Date -Format HHmmss
$q5 = Strapi-Create @{
    financing = [int]$finNumId
    receiptNumber = "Q-$ts-5"
    amount = 386.36
    currency = "PAB"
    status = "abonado"
    dueDate = "2026-05-01"
    quotaNumber = 5
    lateFeeAmount = 0
}
$q5Id = $q5.data.documentId
Write-Host "[1a] Cuota #5 creada: $q5Id (abonado, dueDate=2026-05-01)"

# 3. Crear abono hijo de #5 por 336.36 (faltante = 50)
$ab5 = Strapi-Create @{
    financing = [int]$finNumId
    receiptNumber = "AB-$ts-5"
    amount = 336.36
    currency = "PAB"
    status = "abonado"
    dueDate = "2026-05-01"
    quotaNumber = 5
    parentRecord = [int]$q5.data.id
    lateFeeAmount = 0
}
Write-Host "[1b] Abono #5 creado: $($ab5.data.documentId) (336.36, parent=$q5Id)"

# 4. Crear cuota #6 pendiente (dueDate mas nueva)
$q6 = Strapi-Create @{
    financing = [int]$finNumId
    receiptNumber = "Q-$ts-6"
    amount = 386.36
    currency = "PAB"
    status = "pendiente"
    dueDate = "2026-05-08"
    quotaNumber = 6
    lateFeeAmount = 0
}
$q6Id = $q6.data.documentId
Write-Host "[2] Cuota #6 creada: $q6Id (pendiente, dueDate=2026-05-08)"

# 5. Pago de $200 via API local
Start-Sleep -Seconds 2
$p = Local-PostBilling @{
    financing = $finId
    amount = 200
    quotaNumber = 0
    dueDate = "2026-05-10"
    status = "abonado"
    currency = "PAB"
    receiptNumber = "PAY-$ts-200"
}
$payId = $p.data.documentId
Write-Host "[3] Pago creado: ${payId} (amount=200, parent=$($p.data.parentRecordId))"

# 6. Verificar a donde fue el pago
Start-Sleep -Seconds 3
$pay = Get-Record ${payId}
Write-Host ""
Write-Host "[4] Estado del pago ${payId}:"
Write-Host "  parentRecordId=$($pay.parentRecord.id)"
Write-Host "  status=$($pay.status)"

# 7. Verificar cuotas
$q5After = Get-Record ${q5Id}
$q6After = Get-Record ${q6Id}
Write-Host ""
Write-Host "[5] Cuota #5 (${q5Id}): status=$($q5After.status), children=$($q5After.childRecords.Length)"
Write-Host "[5] Cuota #6 (${q6Id}): status=$($q6After.status), children=$($q6After.childRecords.Length)"

# 8. Evaluar
if ($p.data.parentRecordId -eq ${q5Id}) {
    Write-Host ""
    Write-Host "[PASS] Pago de 200 se vinculo correctamente a la cuota #5 (abonada mas antigua)"
} else {
    Write-Host ""
    Write-Host "[FAIL] Pago se vinculo a $($p.data.parentRecordId) en vez de ${q5Id}"
}

# 9. Listar adelantos generados
$all = Strapi-List "filters[financing][documentId][`$eq]=$finId", "pagination[pageSize]=100"
Write-Host "`n[6] Todos los records del financing:"
$all.data | ForEach-Object {
    $pr = $_.parentRecord
    $parentInfo = if ($pr -and $pr.id) { "parent=$($pr.id)" } else { "raiz" }
    Write-Host "  q#=$($_.quotaNumber) status=$($_.status) amount=$($_.amount) $parentInfo"
}

Write-Host "`n========================================"
Write-Host "FIN E2E"
Write-Host "========================================"
