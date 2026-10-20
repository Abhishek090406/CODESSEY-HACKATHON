terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource 1: One private Blob container for connection health reports
resource "azurerm_storage_container" "reports_blob_container" {
  name                  = "connection-reports-${var.environment}"
  storage_account_name  = var.storage_account_name
  container_access_type = "private"
}

# Resource 2: One Container App for connection health reporting SaaS
resource "azurerm_container_app" "app" {
  name                         = "uc03-connection-health-${var.environment}"
  container_app_environment_id = var.container_app_environment_id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  template {
    container {
      name   = "connection-health-app"
      image  = "${var.container_image}:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = var.environment == "dev" ? "development" : "production"
      }
      env {
        name  = "PORT"
        value = tostring(var.app_port)
      }
      env {
        name  = "BLOB_CONTAINER_NAME"
        value = azurerm_storage_container.reports_blob_container.name
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.app_port
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  lifecycle {
    ignore_changes = [
      workload_profile_name,
      ingress[0].transport,
      ingress[0].traffic_weight,
      template[0].http_scale_rule,
    ]
  }
}

output "container_app_fqdn" {
  description = "The FQDN of the deployed Container App"
  value       = azurerm_container_app.app.latest_revision_fqdn
}

output "health_url" {
  description = "Public /health endpoint URL"
  value       = "https://${azurerm_container_app.app.latest_revision_fqdn}/health"
}

output "blob_container_name" {
  description = "Name of created private blob container"
  value       = azurerm_storage_container.reports_blob_container.name
}
